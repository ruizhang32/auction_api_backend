import emailValidator from 'email-validator';
import * as auctions from '../models/auction.server.model';
import * as users from '../models/user.server.model';

// ——————————————————————————————Check User——————————————————————————————————
// names can not be null, names have to be string, minLength: 1
const isNameSchemaValid = async (name: string) : Promise<boolean> => {
    return name !== null && typeof (name) === 'string' && name.length >= 1;
}

const isEmailSchemaValid = async (email: string): Promise<boolean> => {
    return email !== null && typeof (email) === 'string' && emailValidator.validate(email);
}

const isPasswordSchemaValid = async (password: string): Promise<boolean> => {
    return password !== null && typeof (password) === 'string' && password.length >= 1;
}

// ——————————————————————————————Check Auction——————————————————————————————————
const isDescriptionSchemaValid = async (description: string) : Promise<boolean> => {
    return description !== null && typeof(description) === 'string';
}

const isEndDateSchemaValid = async (endDate: string) : Promise<boolean> => {
    const now = Date.parse(new Date().toISOString());
    const endDateTimeStamp = Date.parse(endDate);
    return (!isNaN(endDateTimeStamp) && (endDateTimeStamp > now));
}

const isReserveSchemaValid = async (reserve: number) : Promise<boolean> => {
    return typeof(reserve) === 'number' && reserve >= 1;
}

// ——————————————————————————————Check Image——————————————————————————————————
const isImageTypeValid = async (type: string) : Promise<boolean> => {
    return type === 'png' || type === 'jpeg' || type === 'jpg' || type === 'gif';
}

// ——————————————————————————————Check Params——————————————————————————————————
// check if parameter can be parse to number
const isParseIntParamValid = async (param: any) : Promise<boolean> => {
    return !isNaN(parseInt(param,10));
}

// check if an auction has any bids, return a boolean value
const anyBid = async (auctionId: number): Promise<boolean> =>{
    try{
        return await auctions.getBidsCountByAuctionId(auctionId)  > 0;
    }catch(err){
        throw err;
    }
}

// check if an auction exists in database, return boolean value
const doesAuctionExist = async (auctionId: number): Promise<boolean> =>{
    try{
        return await auctions.getSingleAuctionModel(auctionId) !== null;
    }catch(err){
       throw err;
    }
}

// check is an category exists in database given an category id, return a boolean value
const isCategoryIdValid = async (categoryId: number) : Promise<boolean> => {
    try{
        return await auctions.checkCategory(categoryId);
    }catch(err){
        throw err;
    }
}

// check if bid higher than the most recent/current highest bid, return boolean
const isBidAmountValid = async (bidAmount: number, auctionId: number) : Promise<boolean> => {
    if (bidAmount <= 0)
        return false;
    try{
        const result = await auctions.getHighestBidByAuctionId(auctionId);
        let highestRecentBid :number;
        if(result !== null){
            highestRecentBid = result;
        }else{
            highestRecentBid = 0;
        }
        return highestRecentBid < bidAmount;
    }catch(err){
        throw err;
    }
}

// check if email has already been registered in DB, return boolean
const doesEmailExist = async(email: string): Promise<boolean>=>{
    try{
        const result = await users.getUserInfoByEmail(email); // check email has not been registered yet
        // if result is null, means can not find any user related with this email, so has not been registered
        return result !== null;
    }
    catch(err) {
        throw err;
    }
}

export {isNameSchemaValid, isEmailSchemaValid, isPasswordSchemaValid, isDescriptionSchemaValid, isEndDateSchemaValid,
    isReserveSchemaValid, isImageTypeValid, isParseIntParamValid, anyBid, doesAuctionExist, isCategoryIdValid, isBidAmountValid,
    doesEmailExist}