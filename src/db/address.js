const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressSchema = new Schema(
    {
        address: {
            type: String
        },
        balance: {
            type: Number,
            default: 0,
        },
        nonce: {
            type: Number,
            default: 0,
        },
        transactions: [{
            type: mongoose.ObjectId,
            ref:  "Tx"
        }]
    },
    { collection: "Address" }
);

module.exports = {
    addressModel: mongoose.model("address", addressSchema),
    addressSchema,
};
