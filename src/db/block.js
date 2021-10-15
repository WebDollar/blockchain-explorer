const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let blockSchema = new Schema(
    {
        height: {
            type: Number,
            index: true,
        },
        hash: {
            type: String,
            index: true,
        },
        data: {
            type: Object
        }
    },
    { collection: "Block" }
);

module.exports = {
    blockModel: mongoose.model("Block", blockSchema),
    blockSchema
};
