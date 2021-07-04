const mongoose = require('mongoose');
const consts = require('../../consts')

mongoose.connect(`mongodb+srv://${consts.db.user}:${consts.db.password}@${consts.db.server}/${consts.db.name}?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true});

const connection = mongoose.connection;

connection.once("open", function() {
    console.log("MongoDB database connection established successfully");
});

module.exports = {
    mongoose,
    connection,
}
