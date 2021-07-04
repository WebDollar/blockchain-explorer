const helpers = require('./helpers')
const axios = require('axios')
const consts = require('../consts')

const chainModel = require('./db/chain')
const blockModel = require('./db/block')

class Sync {

    constructor() {
    }

    async start(){
        while (1){

            try{
                await helpers.sleep(200 )

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

                        const txs = block.transactions
                        for (const txId of txs){

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
