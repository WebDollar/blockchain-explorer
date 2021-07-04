const {chainModel} = require('./db/chain')

module.exports = {

    initialize(app){

        app.get('/chain', async function (req, res) {

            try{

                const chain = await chainModel.findOne({})
                res.end(JSON.stringify( chain.toJSON() ));

            }catch(err){

            }

        })

    }

}
