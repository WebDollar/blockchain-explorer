const helpers = require('./helpers')
const axios = require('axios')
const consts = require('../consts')

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
                const blockHeight = data.blocks.length
                const lastBlockHash = data.blocks.lastBlockHash

                const foundChain = await chainModel.findOne()
                if (!foundChain){

                    await chainModel.create({
                        height: 0,
                        hash: "",
                        circulatingSupply: 0,
                    })

                    continue

                } else {

                    console.log(blockHeight, foundChain.height);

                    if (foundChain.height === blockHeight && foundChain.hash === lastBlockHash){
                        await helpers.sleep(100 )
                        continue
                    }else
                    if (foundChain.height > 1){

                        const out = await axios.get(consts.fallback+'blocks/at/'+(foundChain.height-1) )
                        const data = out.data

                        if (!data || !data.block)
                            throw "block was not received"

                        const block = data.block
                        if (block.hash !== foundChain.hash){

                            const block = await blockModel.findOne({ height: foundChain.height } )
                            if (!block) throw "block was not found"

                            await blockModel.deleteOne({ height: foundChain.height } )

                            foundChain.height = foundChain.height -1
                            foundChain.hash = block.hashPrev
                            foundChain.circulatingSupply = foundChain.circulatingSupply - Number.parseInt(block.data.reward)
                            await foundChain.save()


                            continue
                        }

                    }

                    if ( foundChain.height < blockHeight) {

                        const out = await axios.get(consts.fallback+'blocks/at/'+foundChain.height )
                        const data = out.data

                        if (!data || !data.block)
                            throw "block was not received"

                        const block = data.block

                        await blockModel.create({
                            height: foundChain.height,
                            hash: block.hash,
                            data: block
                        })

                        foundChain.height = foundChain.height + 1
                        foundChain.hash = block.hash
                        foundChain.circulatingSupply = foundChain.circulatingSupply + Number.parseInt(block.reward)

                        if (foundChain.height === hardFork.BLOCK_NUMBER ){

                            for (const addr in hardFork.ADDRESS_BALANCE_REDUCTION){
                                const amount = hardFork.ADDRESS_BALANCE_REDUCTION[addr]
                                let address = await addressModel.findOne({address: addr })
                                address.balance = address.balance - amount
                                await address.save()
                            }

                            await addressModel.create({
                                address: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.ADDRESS,
                                amount: hardFork.GENESIS_ADDRESSES_CORRECTION.TO.BALANCE,
                            })

                            const txs = block.data.transactions
                            for (const txId of txs.reverse() ){

                                const tx = txModel.findOne({txId})
                                if (!tx) throw "Tx was not found"

                                await Promise.all( tx.data.to.addresses.map( async to => {

                                    let address = await addressModel.findOne({address: to.address})

                                    address.balance = address.balance - Number.parseInt(to.amount)
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

                                }) )

                                await Promise.all( tx.data.from.addresses.map( async (from, index) => {

                                    const address = await addressModel.findOne({ address: from.address })
                                    if (!address) throw "Address was not found" + from.address

                                    address.balance = address.balance - Number.parseInt(from.amount)
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

                                } ) )

                                await txModel.deleteOne({txId})
                            }
                        }

                        const minerAddress = addressHelper.convertAddress(block.data.minerAddress);
                        let address = await addressModel.findOne({address: minerAddress})
                        if (!address){
                            await addressModel.create({
                                address: minerAddress,
                                balance: Number.parseInt(block.reward),
                            })
                        } else {
                            address.balance = address.balance + Number.parseInt(block.reward)
                            await address.save()
                        }

                        const txs = block.data.transactions
                        for (const txId of txs){

                            const out = await axios.get(consts.fallback+'transactions/get/'+txId )
                            const data = out.data

                            if (!data || !data.tx)
                                throw "tx was not received"

                            const txData = data.tx

                            let tx = await txModel.create({
                                txId: txId,
                                data: txData,
                                from: [],
                                to: [],
                            })

                            await Promise.all( txData.to.addresses.map( async to => {
                                let address = await addressModel.findOne({address: to.address})

                                const amount = Number.parseInt(to.amount)
                                let promise

                                if (!address){
                                    promise = addressModel.create({
                                        address: to.address,
                                        balance: amount,
                                    })
                                } else {
                                    address.balance = address.balance + amount
                                    promise = address.save()
                                }

                                return Promise.all([
                                    promise,
                                    addressTxModel.create({
                                        address: to.address,
                                        txId: txId,
                                    })
                                ])

                            }) )

                            await Promise.all( txData.from.addresses.map( async (from, index) => {

                                const address = await addressModel.findOne({ address: from.address })

                                const amount = Number.parseInt(from.amount)

                                if (!address) throw "Address was not found"+from.address

                                address.balance = address.balance - amount
                                if (index === 0) address.nonce = address.nonce + 1

                                let promise;
                                if (address.balance === 0 && address.nonce === 0)
                                    promise = addressModel.deleteOne(({address: from.address}))

                                return Promise.all([
                                    promise,
                                    addressTxModel.create({
                                        address: from.address,
                                        txId: txId,
                                    })
                                ])
                            } ) )

                            await tx.save()

                        }

                        await foundChain.save()
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
