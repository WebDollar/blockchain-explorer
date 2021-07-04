const {chainModel} = require('./db/chain')
const {blockModel} = require('./db/block')

module.exports = {

    initialize(app){

        app.get('/chain', async function (req, res) {

            try{

                const chain = await chainModel.findOne({})
                res.end( JSON.stringify( chain.toJSON() ) );

            }catch(err){
                res.end( err );
            }

        });

        app.get('/blocks', async function (req, res) {

            try{

                let start = Number.parseInt(req.query.start || '0')
                let end = Number.parseInt( req.query.end || '0' )

                if (end - start > 10)
                    throw "Requested too many blocks"

                const blocks = await blockModel.find({ height: { $gte: start, $lt: end } })
                res.end( JSON.stringify( blocks.map( (it)=>it.toJSON() ) ) );
            }catch(err){
                res.end( err );
            }

        })

    }

}
