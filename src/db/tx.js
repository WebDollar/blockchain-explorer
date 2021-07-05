const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const {addressSchema} = require('./address')

let txSchema = new Schema(
    {
        txId: {
            type: String
        },
        data: {
            type: Object
        },
        from: [{
            type: mongoose.ObjectId,
            ref: "Address"
        }],
        to: [{
            type: mongoose.ObjectId,
            ref: "Address"
        }],

    },
    { collection: "Tx" }
);

module.exports = {
    txModel: mongoose.model("tx", txSchema),
    txSchema
};
