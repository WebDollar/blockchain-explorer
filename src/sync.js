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
    
    async save(promises, allAddresses, session){
    
    	const deleted = [];
    
        for (const key in allAddresses){
            if ( allAddresses[key].balance === 0 && allAddresses[key].nonce === 0 ) deleted.push( key )
            else promises.push( allAddresses[key].save() )
        }

        if (deleted.length)
	        promises.push( addressModel.deleteMany( {address: { $in: deleted } } ).session(session) )

	    //console.log("saving", promises.length)
        return  Promise.all(promises)
    }

    async getAllAddresses(block, session ){

        const minerAddress = addressHelper.convertAddress(block.data.minerAddress);

        const allAddresses = {}
        allAddresses[minerAddress] = false

        for (const txData of block.data.transactions) {
            txData.to.addresses.map(to => allAddresses[to.address] = false)
            txData.from.addresses.map(from => allAddresses[from.address] = false )
        }

        const output = await addressModel.find({ address: {$in: Object.keys(allAddresses) }} ).session(session)

        const insertMissingAddresses = []
        for (const out of output)
            if ( out )
                allAddresses[out.address] = out

        for (const addr in allAddresses)
            if (allAddresses[addr] === false )
                insertMissingAddresses.push({ address: addr,  balance: 0,  txs: 0, })

        const output2 = await addressModel.insertMany( insertMissingAddresses, {session} )
        for (const out of output2)
            allAddresses[out.address] = out

        return {minerAddress, allAddresses}
    }

    async start(){

        let foundChain = await chainModel.findOne()
        let hasError = false

        let exit = false
        process.on('SIGINT', function() {
            exit = true
        });

        while (1){

            try{

                if (exit) {
                    console.log("FINISHED JOBS");
                    process.exit()
                    return false
                }

                const out = await axios.get(consts.fallback, {timeout: 2000})

                const session = await mongoose.startSession();
                await session.withTransaction(async () => {

                    const data = out.data
                    const blocksHeight = data.blocks.length
                    const lastBlockHash = data.blocks.lastBlockHash

                    if (hasError){
                        foundChain = await chainModel.findOne().session(session)
                        hasError = false
                    }

                    if (!foundChain){

                        await chainModel.create([{
                            height: 0,
                            hash: "",
                            circulatingSupply: 0,
                            transactionsCount: 0,
                        }], {session } )

                        return
                    }


                    console.log(blocksHeight, foundChain.height);

                    if (foundChain.height === blocksHeight && foundChain.hash === lastBlockHash){
                        await helpers.sleep(5000 )
                        return
                    }

                    let receivedData = await axios.get(consts.fallback+consts.fallbackSecret+'/blocks_complete/at/'+(foundChain.height), {timeout: 2000} )
                    let counter = 1

                    if (!receivedData) throw "receivedData was not received"
                    receivedData = receivedData.data


                    for (let q=0; q < counter; q++) {

                        if (!receivedData || !receivedData.result) throw "block was not received"

                        const block = receivedData.block

                        if (foundChain.height > 1 && foundChain.height === block.height && block.hashPrev !== foundChain.hash) {

                            console.log("fork", foundChain.height )

                            let blockDB = await blockModel.findOne({ height: foundChain.height -1 }).session(session);
                            if (!blockDB) throw "block was not found"

                            foundChain.height = foundChain.height - 1
                            foundChain.hash = blockDB.data.hashPrev
                            foundChain.circulatingSupply = foundChain.circulatingSupply - Number.parseInt(block.reward)
                            foundChain.transactionsCount = foundChain.transactionsCount - block.data.transactions.length

                            const txs = block.data.transactions

                            let fees = this.computeFees(txs)
                            let {minerAddress, allAddresses} = await this.getAllAddresses(block, session )

                            const promises = [
                                blockModel.deleteOne({height: block.height -1 }).session(session),
                                foundChain.save(),
                            ]
                            const txsIds = []

                            for (const tx of txs.reverse()) {

                                txsIds.push(tx.txId)

                                tx.to.addresses.map( (to, index) => {
                                    const amount = Number.parseInt(to.amount)
                                    allAddresses[to.address].balance = allAddresses[to.address].balance - amount
                                    allAddresses[to.address].txs = allAddresses[to.address].txs - 1
                                    allAddresses[to.address].totalReceived = allAddresses[to.address].totalReceived - amount
                                })

                                tx.from.addresses.map( (from, index) => {
                                    const amount = Number.parseInt(from.amount)
                                    allAddresses[from.address].balance = allAddresses[from.address].balance + amount
                                    allAddresses[from.address].txs = allAddresses[from.address].txs - 1
                                    if (index === 0) allAddresses[from.address].nonce = allAddresses[from.address].nonce - 1
                                    allAddresses[from.address].totalSent = allAddresses[from.address].totalSent - amount
                                })

                            }

                            allAddresses[minerAddress].balance = allAddresses[minerAddress].balance - Number.parseInt(block.reward) - fees

                            if (txsIds.length){
                                promises.push( txModel.deleteMany( { txId: {$in: txsIds } } ).session(session) )
                                promises.push( addressTxModel.deleteMany( { txId: {$in: txsIds } } ).session(session) )
                            }
                            await this.save(promises, allAddresses, session)

                            continue
                        }

                        foundChain.height = foundChain.height + 1
                        foundChain.hash = block.hash
                        foundChain.circulatingSupply = foundChain.circulatingSupply + Number.parseInt(block.reward)
                        foundChain.transactionsCount = foundChain.transactionsCount + block.data.transactions.length

                        const transactions = block.data.transactions

                        let fees = this.computeFees(transactions)
                        let {minerAddress, allAddresses} = await this.getAllAddresses(block, session )

                        allAddresses[minerAddress].balance = allAddresses[minerAddress].balance + Number.parseInt(block.reward)+ fees

                        const promises = [
                            blockModel.create([{
                                height: block.height,
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
                            }], {session } ),
                            foundChain.save(),
                        ]

                        if (foundChain.height-1 === hardFork.BLOCK_NUMBER ) {

                            for (const addr in hardFork.ADDRESS_BALANCE_REDUCTION) {

                                if (!allAddresses[addr])
                                    allAddresses[addr] = await addressModel.findOne({ address: addr } ).session(session)

                                const amount = hardFork.ADDRESS_BALANCE_REDUCTION[addr]
                                allAddresses[addr].balance = allAddresses[addr].balance + amount
                            }

                            allAddresses[hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS] = await addressModel.create([{
                                address: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS,
                                balance: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.BALANCE,
                                txs: 0,
                            }], {session } )
                        }

                        const insertAddressTxModel = []
                        const insertTxModel = []

                        for (let i=0; i < transactions.length; i++){

                            const txData = transactions[i]
                            const txId = txData.txId

                            let txMongoId = mongoose.Types.ObjectId();

                            insertTxModel.push( {
                                _id: txMongoId,
                                txId: txId,
                                data: txData,
                                blockHeight: foundChain.height,
                                timestamp: block.timeStamp,
                            } )

                            txData.to.addresses.map( (to, index) => {

                                const amount = Number.parseInt(to.amount)
                                allAddresses[to.address].balance = allAddresses[to.address].balance + amount
                                allAddresses[to.address].txs = allAddresses[to.address].txs + 1
                                allAddresses[to.address].totalReceived = allAddresses[to.address].totalReceived + amount

                                insertAddressTxModel.push({
                                    address: to.address,
                                    tx: txMongoId,
                                    txId: txId,
                                    type: true,
                                    blockHeight: block.height,
                                    txHeight: allAddresses[to.address].txs-1,
                                })

                            })

                            txData.from.addresses.map( (from, index) => {

                                if (!allAddresses[from.address]) throw "Address was not found"+from.address

                                const amount = Number.parseInt(from.amount)
                                allAddresses[from.address].balance = allAddresses[from.address].balance - amount
                                allAddresses[from.address].txs = allAddresses[from.address].txs + 1
                                allAddresses[from.address].totalSent = allAddresses[from.address].totalSent + amount

                                if (index === 0) allAddresses[from.address].nonce = allAddresses[from.address].nonce + 1

                                insertAddressTxModel.push({
                                    address: from.address,
                                    tx: txMongoId,
                                    txId: txId,
                                    type: false,
                                    blockHeight: block.height,
                                    txHeight: allAddresses[from.address].txs-1,
                                })

                            } )

                        }

                        promises.push( txModel.insertMany( insertTxModel, {session} ) )
                        promises.push( addressTxModel.insertMany( insertAddressTxModel, {session} ) )

                        await this.save(promises, allAddresses, session )

                    }

                })

                session.endSession();

            }catch(err){
                console.error(err)
                hasError = true
                await helpers.sleep(1000 )
            }

        }
    }

}
module.exports = new Sync()
