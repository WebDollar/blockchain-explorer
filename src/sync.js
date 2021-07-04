const helpers = require('./helpers')
const axios = require('axios')
const consts = require('../consts')

const {chainModel} = require('./db/chain')
const {blockModel} = require('./db/block')
const {txModel} = require('./db/tx')
const {addressModel} = require('./db/address')
const addressHelper = require('./address-helper')

class Sync {

    constructor() {
    }

    async start(){
        while (1){

            try{
                await helpers.sleep(100 )

                const out = await axios.get(consts.fallback)

                const data = out.data
                const blockHeight = data.blocks.length
                const lastBlockHash = data.blocks.lastBlockHash

                const foundChain = await chainModel.findOne()
                if (!foundChain){

                    await chainModel.create({
                        height: 0,
                        hash: "",
                    })

                    continue

                } else {


                    if (foundChain.height === blockHeight && foundChain.hash === lastBlockHash){
                        continue
                    }else
                    if (foundChain.height > 1){

                        const out = await axios.get(consts.fallback+'blocks/at/'+(foundChain.height-1) )
                        const data = out.data

                        if (!data || !data.block)
                            throw "block was not received"

                        const block = data.block
                        if (block.hash !== foundChain.hash){

                            await blockModel.deleteOne({ height: foundChain.height })

                            foundChain.height = foundChain.height -1
                            foundChain.hash = block.hashPrev
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

                            const toArray = await Promise.all( txData.to.addresses.map( async to => {
                                let address = await addressModel.findOne({address: to.address})

                                const amount = Number.parseInt(to.amount)

                                if (!address){
                                    address = await addressModel.create({
                                        address: to.address,
                                        balance: amount,
                                    })
                                } else {
                                    address.balance = address.balance + amount

                                    console.log("new balance", address.balance)
                                    await address.save()
                                }

                                return address
                            }) )

                            const fromArray = await Promise.all( txData.from.addresses.map( async from => {

                                const address = await addressModel.findOne({ address: from.address })

                                const amount = Number.parseInt(to.amount)

                                if (!address)
                                    throw "Address was not found"+from.address

                                console.log("new balance", address.balance)
                                address.balance = address.balance - amount

                                await address.save();

                                return address
                            }) )

                            await txModel.create({
                                txId: txId,
                                data: txData,
                                from: fromArray,
                                to: toArray,
                            })

                        }

                        await foundChain.save()
                    }
                }

            }catch(err){
                console.error(err)
            }

        }
    }

}
module.exports = new Sync()
