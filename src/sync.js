const helpers = require('./helpers')
const axios = require('axios')
const consts = require('../consts')
const mongoose = require('mongoose');

const {chainModel} = require('./db/chain')
const {blockModel} = require('./db/block')
const {txModel} = require('./db/tx')
const {addressModel} = require('./db/address')
const {addressTxModel} = require('./db/address-tx')
const addressHelper = require('./address-helper')
const hardFork = require('./hard-fork')

class Sync {

    constructor() {
    }

    async start(){
        while (1){

            try{

                const out = await axios.get(consts.fallback, {timeout: 2000})

                const data = out.data
                const blocksHeight = data.blocks.length
                const lastBlockHash = data.blocks.lastBlockHash

                const foundChain = await chainModel.findOne()
                if (!foundChain){

                    await chainModel.create({
                        height: 0,
                        hash: "",
                        circulatingSupply: 0,
                        transactionsCount: 0,
                    })

                    continue

                } else {

                    console.log(blocksHeight, foundChain.height);

                    if (foundChain.height === blocksHeight && foundChain.hash === lastBlockHash){
                        await helpers.sleep(100 )
                        continue
                    } else {

                        let receivedData = await axios.get(consts.fallback+consts.fallbackSecret+'/blocks_complete/at/'+(foundChain.height), {timeout: 2000} )
                        let counter = 1

                        if (!receivedData) throw "receivedData was not received"
                        receivedData = receivedData.data

                        for (let q=0; q < counter; q++) {

                            if (!receivedData || !receivedData.result) throw "block was not received"

                            const block = receivedData.block

                            if (foundChain.height > 1 && foundChain.height === block.height && block.hashPrev !== foundChain.hash) {

                                const blockDB = await blockModel.findOne({height: foundChain.height})
                                if (!blockDB) throw "block was not found"

                                foundChain.height = foundChain.height - 1
                                foundChain.hash = block.data.hashPrev
                                foundChain.circulatingSupply = foundChain.circulatingSupply - Number.parseInt(block.data.reward)
                                foundChain.transactionsCount = foundChain.transactionsCount - block.data.transactions.length

                                await Promise.all([
                                    blockModel.deleteOne({height: foundChain.height}),
                                    foundChain.save() ,
                                ])

                                const txs = block.data.transactions
                                for (const tx of txs.reverse()) {

                                    const txId = tx.txId

                                    const txObj = txModel.findOne({ txId: txId } )
                                    const tx = txObj.data

                                    let addresses = [
                                        txModel.delete({ txId: block.hash }),
                                        addressTxModel.delete({txId: txId}),
                                    ]
                                        .concat(tx.to.addresses.map( to => addressModel.findOne({address: to.address}) ))
                                        .concat(tx.from.addresses.map( from => addressModel.findOne({address: from.address}) ))

                                    addresses = await Promise.all(addresses)
                                    let counter = 1

                                    let arr = []
                                    tx.to.addresses.map( (to, index) => {

                                        let address = addresses[counter+index]

                                        address.balance = address.balance - Number.parseInt(to.amount)
                                        address.txs = address.txs - 1

                                        arr.push(
                                            (address.balance === 0 && address.nonce === 0) ? addressModel.deleteOne({address: to.address}) : address.save(),
                                        )

                                    })
                                    counter += tx.to.addresses.length

                                    tx.from.addresses.map(async (from, index) => {

                                        let address = addresses[counter+index]

                                        address.balance = address.balance - Number.parseInt(from.amount)
                                        address.txs = address.txs - 1
                                        if (index === 0) address.nonce = address.nonce - 1

                                        arr.push(
                                            (address.balance === 0 && address.nonce === 0) ? addressModel.deleteOne({address: from.address}) : address.save(),
                                        )

                                    })

                                    await Promise.all(arr)
                                }
                                continue
                            }

                            foundChain.height = foundChain.height + 1
                            foundChain.hash = block.hash
                            foundChain.circulatingSupply = foundChain.circulatingSupply + Number.parseInt(block.reward)
                            foundChain.transactionsCount = foundChain.transactionsCount + block.data.transactions.length

                            const transactions = block.data.transactions

                            let fees = 0
                            for (const txData of transactions){
                                txData.to.addresses.forEach( (to) => {
                                    fees -= Number.parseInt(to.amount)
                                })
                                txData.from.addresses.forEach( (from,) => {
                                    fees += Number.parseInt(from.amount)
                                })
                            }

                            const minerAddress = addressHelper.convertAddress(block.data.minerAddress);
                            let address = await addressModel.findOne({address: minerAddress})
                            let promiseMiner
                            if (!address)
                                promiseMiner = addressModel.create({
                                    address: minerAddress,
                                    balance: Number.parseInt(block.reward) + fees ,
                                    txs: 0,
                                })
                            else {
                                address.balance = address.balance + Number.parseInt(block.reward)+ fees
                                promiseMiner = address.save()
                            }

                            await Promise.all([
                                blockModel.create({
                                    height: foundChain.height,
                                    hash: block.hash,
                                    data: block
                                }),
                                foundChain.save(),
                                promiseMiner
                            ])

                            if (foundChain.height === hardFork.BLOCK_NUMBER ) {

                                const arr = []
                                for (const addr in hardFork.ADDRESS_BALANCE_REDUCTION) {
                                    const amount = hardFork.ADDRESS_BALANCE_REDUCTION[addr]
                                    let address = await addressModel.findOne({address: addr})
                                    address.balance = address.balance - amount
                                    arr.push( address.save() )
                                }

                                arr.push( addressModel.create({
                                    address: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS,
                                    amount: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.BALANCE,
                                    txs: 0,
                                }) )
                                await Promise.all(arr)
                            }

                            for (const txData of transactions){

                                const txId = txData.txId

                                let txMongoId = mongoose.Types.ObjectId();

                                let addresses = [
                                    txModel.create({
                                        _id: txMongoId,
                                        txId: txId,
                                        data: txData,
                                        blockHeight: foundChain.height,
                                        timestamp: block.timeStamp,
                                    }),
                                ]
                                    .concat(txData.to.addresses.map( to => addressModel.findOne({address: to.address}) ))
                                    .concat(txData.from.addresses.map( from => addressModel.findOne({address: from.address}) ))

                                addresses = await Promise.all(addresses)

                                let counter = 1

                                let arr = [];
                                txData.to.addresses.map( async (to, index) => {

                                    let address = addresses[counter+index]

                                    const amount = Number.parseInt(to.amount)
                                    let promise

                                    if (!address)
                                        promise = addressModel.create({
                                            address: to.address,
                                            balance: amount,
                                            txs: 1,
                                        })
                                    else {
                                        address.balance = address.balance + amount
                                        address.txs = address.txs + 1
                                        promise = address.save()
                                    }

                                    arr.push(
                                        promise,
                                        addressTxModel.create({
                                            address: to.address,
                                            tx: txMongoId,
                                            type: true,
                                            blockHeight: foundChain.height
                                        })
                                    )

                                })

                                counter += txData.to.addresses.length

                                txData.from.addresses.map( async (from, index) => {

                                    let address = addresses[counter+index]
                                    if (!address) throw "Address was not found"+from.address

                                    address.balance = address.balance - Number.parseInt(from.amount)
                                    address.txs = address.txs + 1
                                    if (index === 0) address.nonce = address.nonce + 1

                                    arr.push(
                                        (address.balance === 0 && address.nonce === 0) ? addressModel.deleteOne({address: from.address}) : address.save(),
                                        addressTxModel.create({
                                            address: from.address,
                                            tx: txMongoId,
                                            type: false,
                                            blockHeight: foundChain.height
                                        })
                                    )

                                } )

                                await Promise.all(arr)
                            }

                        }

                    }

                }

            }catch(err){
                console.error(err.toString())
                await helpers.sleep(1000 )
            }

        }
    }

}
module.exports = new Sync()
