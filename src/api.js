const {chainModel} = require('./db/chain')
const {blockModel} = require('./db/block')
const {txModel} = require('./db/tx')
const {addressModel} = require('./db/address')
const {addressTxModel} = require('./db/address-tx')
const Helpers = require('./helpers')
const sanitize = require('mongo-sanitize');

module.exports = {

    initialize(app){

        app.get('/chain', async function (req, res) {

            try{

                const chain = await chainModel.findOne({})
                res.end( JSON.stringify( chain.toJSON() ) );

            }catch(err){
                res.status(500).send(err.toString())
            }

        });

        app.get('/blocks', async function (req, res) {

            try{

                let start = Number.parseInt( sanitize(req.query.start) || '0')
                let end = Number.parseInt( sanitize(req.query.end) || '0' )

                if (end - start > 10)
                    throw "Requested too many blocks"

                const blocks = await blockModel.find({ height: { $gte: start, $lt: end } })
                res.end( JSON.stringify( blocks.map( it => it.toJSON() ) ) );
            }catch(err){
                res.status(500).send(err.toString())
            }

        })

        app.get('/block/:param', async function (req, res) {

            try{

                let block

                const param = sanitize(req.params.param)

                if (param.length === 64)
                    block = await blockModel.findOne({ hash: param })
                else
                    block = await blockModel.findOne({ height: Number.parseInt(param) })


                if (!block) throw "Block was not found"

                res.end( JSON.stringify( block.toJSON() ) );

            }catch(err){
                res.status(500).send(err.toString())
            }

        })

        app.get('/tx/:txId', async function (req, res) {

            try{

                const tx = await txModel.findOne({ txId: sanitize( req.params.txId ) })

                if (!tx) throw "Tx was not found"

                res.end( JSON.stringify( tx.toJSON() ) );

            }catch(err){
                res.status(500).send(err.toString())
            }

        })

        app.get('/address', async function (req, res) {

            try{

                const address = await addressModel.findOne({ address: sanitize(req.query.address) })

                if (!address) throw "Address was not found"

                res.end( JSON.stringify( address.toJSON() ) );

            }catch(err){
                res.status(500).send(err.toString())
            }

        })

        app.get('/address-txs', async function (req, res) {
            try{
                const txs = await addressTxModel.find({ address: sanitize(req.query.address) }).sort({blockHeight: -1} ).limit(10).populate('tx')

                if (!txs) throw "Address was not found"

                res.end( JSON.stringify( txs.map( it => it.toJSON() ) ) );
            }catch(err){
                res.status(500).send(err.toString())
            }
        })

        app.get('/search', async function (req, res) {
            try{

                const param = sanitize(req.query.param)

                if (param.length === 64) {
                    const block = await blockModel.findOne({hash: param });
                    if (block) return res.end( JSON.stringify( {result: "block"} ) );

                    const tx = await txModel.findOne({txId: param});
                    if (tx) return res.end( JSON.stringify( {result: "tx"} ) );

                    throw "Hash not found"
                }

                if (param.indexOf("WEBD") === 0){
                    const address = await addressModel.findOne({address: param});
                    if (address) return res.end( JSON.stringify( {result: "address"} ) );
                    throw "Address not found"
                }

                if (Helpers.isNumeric(param)){
                    const block = await blockModel.findOne({height: param });
                    if (block) return res.end( JSON.stringify( {result: "block"} ) );

                    throw "Hash not found"
                }

                throw "Invalid input"
            }catch(err){
                res.status(500).send(err.toString())
            }
        })

    }

}
