const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressTxSchema = new Schema(
    {
        address: {
            type: String,
        },
        tx: {
            type: mongoose.ObjectId,
            ref:  "Tx"
        },
        type: {
            type: Boolean,
        },
        blockHeight:{
            type: Number,
        },
    },
    { collection: "AddressTx" }
);

module.exports = {
    addressTxModel: mongoose.model("AddressTx", addressTxSchema),
    addressTxSchema,
};
