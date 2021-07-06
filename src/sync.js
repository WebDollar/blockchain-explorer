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

                const out = await axios.get(consts.fallback)

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
                    } else
                    if (foundChain.height > 1){

                        const out = await axios.get(consts.fallback+'blocks/at/'+(foundChain.height-1) )
                        const data = out.data

                        if (!data || !data.block)
                            throw "block was not received"

                        const block = data.block

                        if (foundChain.height === block.height && block.hash !== foundChain.hash) {

                            const block = await blockModel.findOne({height: foundChain.height})
                            if (!block) throw "block was not found"

                            await blockModel.deleteOne({height: foundChain.height})

                            foundChain.height = foundChain.height - 1
                            foundChain.hash = block.hashPrev
                            foundChain.circulatingSupply = foundChain.circulatingSupply - Number.parseInt(block.data.reward)
                            foundChain.transactionsCount = foundChain.transactionsCount - block.data.transactions.length
                            await foundChain.save()

                            const txs = block.data.transactions
                            for (const txId of txs.reverse()) {

                                const tx = txModel.findOne({txId})
                                if (!tx) throw "Tx was not found"

                                await Promise.all(tx.data.to.addresses.map(async to => {

                                    let address = await addressModel.findOne({address: to.address})

                                    address.balance = address.balance - Number.parseInt(to.amount)
                                    address.txs = address.txs - 1
                                    let promise
                                    if (address.balance === 0 && address.nonce === 0)
                                        promise = addressModel.deleteOne({address: to.address})
                                    else
                                        promise = address.save()

                                    await Promise.all([
                                        promise,
                                        addressTxModel.delete({
                                            address: to.address,
                                            txId: txId,
                                        })
                                    ])

                                }))

                                await Promise.all(tx.data.from.addresses.map(async (from, index) => {

                                    const address = await addressModel.findOne({address: from.address})
                                    if (!address) throw "Address was not found" + from.address

                                    address.balance = address.balance - Number.parseInt(from.amount)
                                    address.txs = address.txs - 1
                                    if (index === 0) address.nonce = address.nonce - 1

                                    let promise
                                    if (address.balance === 0 && address.nonce === 0)
                                        promise = addressModel.deleteOne({address: from.address})
                                    else
                                        promise = address.save();

                                    await Promise.all([
                                        promise,
                                        addressTxModel.delete({
                                            address: from.address,
                                            txId: txId,
                                        })
                                    ])

                                }))

                                await txModel.deleteOne({txId})
                            }
                            continue
                        }

                        foundChain.height = foundChain.height + 1
                        foundChain.hash = block.hash
                        foundChain.circulatingSupply = foundChain.circulatingSupply + Number.parseInt(block.reward)
                        foundChain.transactionsCount = foundChain.transactionsCount + block.data.transactions.length

                        const minerAddress = addressHelper.convertAddress(block.data.minerAddress);
                        let address = await addressModel.findOne({address: minerAddress})
                        let promiseMiner
                        if (!address){
                            promiseMiner = addressModel.create({
                                address: minerAddress,
                                balance: Number.parseInt(block.reward),
                                txs: 0,
                            })
                        } else {
                            address.balance = address.balance + Number.parseInt(block.reward)
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

                            for (const addr in hardFork.ADDRESS_BALANCE_REDUCTION) {
                                const amount = hardFork.ADDRESS_BALANCE_REDUCTION[addr]
                                let address = await addressModel.findOne({address: addr})
                                address.balance = address.balance - amount
                                await address.save()
                            }

                            await addressModel.create({
                                address: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS,
                                amount: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.BALANCE,
                                txs: 0,
                            })

                        }

                        const txs = block.data.transactions
                        for (const txId of txs){

                            const out = await axios.get(consts.fallback+'transactions/get/'+txId )
                            const data = out.data

                            if (!data || !data.tx)
                                throw "tx was not received"

                            const txData = data.tx

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

                                if (!address){
                                    promise = addressModel.create({
                                        address: to.address,
                                        balance: amount,
                                        txs: 1,
                                    })
                                } else {
                                    address.balance = address.balance + amount
                                    address.txs = address.txs + 1
                                    promise = address.save()
                                }

                                arr.push(promise)
                                arr.push(addressTxModel.create({
                                    address: to.address,
                                    tx: txMongoId,
                                    type: true,
                                    blockHeight: foundChain.height
                                }))

                            })

                            counter += txData.to.addresses.length

                            txData.from.addresses.map( async (from, index) => {

                                let address = addresses[counter+index]
                                if (!address) throw "Address was not found"+from.address

                                address.balance = address.balance - Number.parseInt(from.amount)
                                address.txs = address.txs + 1
                                if (index === 0) address.nonce = address.nonce + 1

                                let promise;
                                if (address.balance === 0 && address.nonce === 0)
                                    promise = addressModel.deleteOne(({address: from.address}))
                                else
                                    promise = address.save()

                                arr.push(promise)
                                arr.push(addressTxModel.create({
                                    address: from.address,
                                    tx: txMongoId,
                                    type: false,
                                    blockHeight: foundChain.height
                                }))

                            } )

                            await Promise.all(arr)

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
