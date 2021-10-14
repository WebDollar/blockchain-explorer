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

    computeFees(transactions){
        let fees = 0
        for (const txData of transactions){
            txData.to.addresses.forEach( (to) => {
                fees -= Number.parseInt(to.amount)
            })
            txData.from.addresses.forEach( (from,) => {
                fees += Number.parseInt(from.amount)
            })
        }
        return fees
    }
    
    async save(promises, allAddresses){
    
    	const deleted = [];
    
        for (const key in allAddresses){
            if ( allAddresses[key].balance === 0 && allAddresses[key].nonce === 0 ) deleted.push( key )
            else promises.push( allAddresses[key].save() )
        }
	
	    promises.push( addressModel.deleteMany( {address: { $in: deleted } } ) )

	    console.log("saving", promises.length)
        await Promise.all(promises)
    }

    async getAllAddresses(block){

        const minerAddress = addressHelper.convertAddress(block.data.minerAddress);

        const allAddresses = {}
        allAddresses[minerAddress] = true

        for (const txData of block.data.transactions) {
            txData.to.addresses.map(to => allAddresses[to.address] = true)
            txData.from.addresses.map(from => allAddresses[from.address] = true)
        }

        const keys = Object.keys(allAddresses)
        const output = await addressModel.find({ address: {$in: keys }} )

        const insertMissingAddresses = []
        for (let i=0; i < keys.length; i++) {
            const addr = keys[i]
            allAddresses[addr] = output[i]
            if (!allAddresses[addr] )
                insertMissingAddresses.push({ address: addr,  balance: 0,  txs: 0, })
        }

        const output2 = await addressModel.insertMany( insertMissingAddresses )
        for (const out of output2)
            allAddresses[out.address] = out

        return {minerAddress, allAddresses}
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
                        await helpers.sleep(5000 )
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

                                const blockDB = await blockModel.findOne({ height: foundChain.height })
                                if (!blockDB) throw "block was not found"

                                foundChain.height = foundChain.height - 1
                                foundChain.hash = blockDB.data.hashPrev
                                foundChain.circulatingSupply = foundChain.circulatingSupply - Number.parseInt(block.reward)
                                foundChain.transactionsCount = foundChain.transactionsCount - block.data.transactions.length

                                await Promise.all([
                                    blockModel.deleteOne({height: foundChain.height + 1 }),
                                    foundChain.save() ,
                                ])

                                const txs = block.data.transactions

                                let fees = this.computeFees(txs)
                                let {minerAddress, allAddresses} = await this.getAllAddresses(block)

                                const promises = []
                                const txsIds = []
                                
                                for (const tx of txs.reverse()) {

                                    txsIds.push(tx.txId)

                                    tx.to.addresses.map( (to, index) => {
                                        allAddresses[to.address].balance = allAddresses[to.address].balance - Number.parseInt(to.amount)
                                        allAddresses[to.address].txs = allAddresses[to.address].txs - 1
                                    })

                                    tx.from.addresses.map( (from, index) => {
                                        allAddresses[from.address].balance = allAddresses[from.address].balance + Number.parseInt(from.amount)
                                        allAddresses[from.address].txs = allAddresses[from.address].txs - 1
                                        if (index === 0) allAddresses[from.address].nonce = allAddresses[from.address].nonce - 1
                                    })

                                }

                                allAddresses[minerAddress].balance = allAddresses[minerAddress].balance - Number.parseInt(block.reward) - fees

                                promises.push( txModel.deleteMany( { txId: {$in: txsIds } } ) )
                                promises.push( addressTxModel.deleteMany( { txId: {$in: txsIds } } ) )
                                await this.save(promises, allAddresses)

                                continue
                            }

                            foundChain.height = foundChain.height + 1
                            foundChain.hash = block.hash
                            foundChain.circulatingSupply = foundChain.circulatingSupply + Number.parseInt(block.reward)
                            foundChain.transactionsCount = foundChain.transactionsCount + block.data.transactions.length

                            const transactions = block.data.transactions

                            let fees = this.computeFees(transactions)
                            let {minerAddress, allAddresses} = await this.getAllAddresses(block)

                            allAddresses[minerAddress].balance = allAddresses[minerAddress].balance + Number.parseInt(block.reward)+ fees

                            await Promise.all([
                                blockModel.create({
                                    height: foundChain.height,
                                    hash: block.hash,
                                    data: {
                                        ...block,
                                        data: {
                                            ...block.data,
                                            transactions: [
                                                ...block.data.transactions.map( tx => ({
                                                    txId: tx.txId,
                                                    from: tx.from.addresses.map (it => ({
                                                        address: it.address,
                                                        amount: it.amount,
                                                    }) ),
                                                    to: tx.to.addresses.map( it => ({
                                                        address: it.address,
                                                        amount: it.amount,
                                                    }) ),
                                                }) ),
                                            ]
                                        }
                                    }
                                }),
                                foundChain.save(),
                            ])

                            if (foundChain.height === hardFork.BLOCK_NUMBER ) {
                                for (const addr in hardFork.ADDRESS_BALANCE_REDUCTION) {
                                    const amount = hardFork.ADDRESS_BALANCE_REDUCTION[addr]
                                    allAddresses[addr].balance = allAddresses[addr].balance - amount
                                }

                                allAddresses[hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS] = await addressModel.create({
                                    address: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS,
                                    amount: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.BALANCE,
                                    txs: 0,
                                })
                            }

                            let insertTxModels = await txModel.insertMany( transactions.map( txData => ({
                                txId: txData.txId,
                                data: txData,
                                blockHeight: foundChain.height,
                                timestamp: block.timeStamp,
                            })) )

                            const promises = []
                            const insertAddressTxModel = []

                            for (let i=0; i < transactions.length; i++){

                                const txData = transactions[i]
                                const txId = txData.txId
                                let txMongoId = insertTxModels[i]._id

                                txData.to.addresses.map( async (to, index) => {

                                    const amount = Number.parseInt(to.amount)
                                    allAddresses[to.address].balance = allAddresses[to.address].balance + amount
                                    allAddresses[to.address].txs = allAddresses[to.address].txs + 1

                                    insertAddressTxModel.push({
                                        address: to.address,
                                        tx: txMongoId,
                                        txId: txId,
                                        type: true,
                                        blockHeight: foundChain.height
                                    })

                                })

                                txData.from.addresses.map( (from, index) => {

                                    if (!allAddresses[from.address]) throw "Address was not found"+from.address

                                    allAddresses[from.address].balance = allAddresses[from.address].balance - Number.parseInt(from.amount)
                                    allAddresses[from.address].txs = allAddresses[from.address].txs + 1
                                    if (index === 0) allAddresses[from.address].nonce = allAddresses[from.address].nonce + 1

                                    insertAddressTxModel.push({
                                        address: from.address,
                                        tx: txMongoId,
                                        txId: txId,
                                        type: false,
                                        blockHeight: foundChain.height
                                    })

                                } )

                            }
                            promises.push( addressTxModel.insertMany( insertAddressTxModel ) )
                            await this.save(promises, allAddresses)

                        }

                    }

                }

            }catch(err){
                console.error(err)
                await helpers.sleep(1000 )
            }

        }
    }

}
module.exports = new Sync()
