import Logger from "../../config/logger";
import {NextFunction, Request, Response} from "express";
import * as auctions from '../models/auction.server.model';
import * as users from '../models/user.server.model';
import * as validation from '../middleware/validation';

// if user provided token, get user id by token
const loggedIn = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    let token: string | string[] = '';
    if(typeof(req.headers["x-authorization"]) === 'string' && req.headers["x-authorization"].length > 0) {
        token = req.headers["x-authorization"];
        try {
            const result = (await users.getUserByToken(token));
            if (result !== null) {
                // set object with user_id and email and return true
                res.locals.id = result[0];
                next();
            }
        } catch (err) {
            if (err.name === 'userTokenErr') {
                res.status(404).send(`${err}`);
            } else {
                res.status(500).send(`ERROR get user by token: ${err}`);
            }
            return;
        }
    }
    else{
        res.locals.id = undefined;
        next();
    }
}

// return user id, email if logged in, otherwise return http code
const loggedInRequired = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    Logger.info('Checking if user logged in...')
    let token: string | string[] = '';
    if(typeof(req.headers["x-authorization"]) === 'string' && req.headers["x-authorization"].length > 0){
      token = req.headers["x-authorization"];
    }else{
        res.status(401).send(`Token not valid`);
        return;
    }
    try{
        const result = await users.getUserByToken(token);
        if (result !== null) {
            // set object with user_id and email and return true
            res.locals.id = result[0];
            res.locals.email = result[1];
            next();
        }
    }catch(err){
        if(err.name === 'userTokenErr'){
            res.status( 404 ).send( `${ err }`);
        }else{
            res.status( 500 ).send( `ERROR get user by token: ${ err }`);
        }
        return;
    }
}

// check logged in user is requesting for checking/operating his/her own profile/auctions
const isUser = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    Logger.info('Checking if user are operating on their own profile/auctions...');
    const userId = parseInt(res.locals.id, 10);
    let requestId: number;
    if(await validation.isParseIntParamValid(req.params.id)){
        requestId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send('Category Id should be a number');
        return;
    }
    if(userId !== requestId){
       res.status( 403 ).send('You are only allow to check/operate on your own profile/auctions');
       return;
    }else{
        next();
    }
}

// check logged in user is the auction seller
const isSeller = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    Logger.info(`Checking if user is the auction ${req.params.id}'s seller...`);
    let requestAuctionId: number;
    if(await validation.isParseIntParamValid(req.params.id)){
        requestAuctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send('Category Id should be a number');
        return;
    }
    try{
        const result = await auctions.getSingleAuctionModel(requestAuctionId);
        const sellerId = result.sellerId;
        const loggedInId = res.locals.id;
        if(sellerId === loggedInId){
           res.locals.seller_id = sellerId;
           next();
        }else{
           res.status( 403 ).send(`You are only allow to change your own auction's information`);
           return;
        }
    }catch (err){
        if(err.name === 'auctionIdErr'){
            res.status(404).send(`${err}`);
        }else{
            res.status( 500 ).send( `ERROR finding an auction ${requestAuctionId} from database: ${ err }`);
        }
        return;
    }
}

export {loggedIn, loggedInRequired, isUser, isSeller}