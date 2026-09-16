"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.loginUser = void 0;
const jwt_1 = require("../../utils/jwt");
const user_model_1 = require("../user/user.model");
const loginUser = async (data) => {
    let user = await user_model_1.UserModel.findOne({
        phone: data.phone,
    });
    if (!user) {
        user = await user_model_1.UserModel.create({
            phone: data.phone,
            name: data.name,
            isOnline: true,
            lastSeen: new Date(),
        });
    }
    else {
        user.name = data.name;
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();
    }
    const token = (0, jwt_1.generateToken)({
        userId: user._id.toString(),
    });
    return {
        token,
        user,
    };
};
exports.loginUser = loginUser;
const getCurrentUser = async (userId) => {
    const user = await user_model_1.UserModel.findById(userId).select("-__v");
    return user;
};
exports.getCurrentUser = getCurrentUser;
