import Logger from "../../config/logger";
import {NextFunction, Request, Response} from "express";
import * as auctions from '../models/auction.server.model';
import * as users from '../models/user.server.model';

// if user provided token, get user id by token
const loggedIn = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    let token: string | string[] = '';
    if(typeof(req.headers["x-authorization"]) === 'string' && req.headers["x-authorization"].length > 0){
        token = req.headers["x-authorization"];
        try{
            const result =  (await users.getUserByToken(token));
            if (result === null) {
                // can not find any user related to given token
                res.status(404).send(`User not found`);
                return;
            }else{
                // set object with user_id and email and return true
                res.locals.id = result[0];
                next();
            }
        }catch(err){
            res.status( 500 ).send( `ERROR get user by token: ${ err }`);
            }
    }else{
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
        if (result === null) {
            // can not find any user related to given token
            res.status(404).send(`User not found`);
            return;
        }else{
            // set object with user_id and email and return true
            res.locals.id = result[0];
            res.locals.email = result[1];
            next();
        }
    }catch(err){
        res.status( 500 ).send( `ERROR get user by token: ${ err }`);
    }
}

// check logged in user is requesting for checking/operating his/her own profile/auctions
const isUser = async (req: Request, res:Response, next: NextFunction): Promise<any> => {
    Logger.info('Checking if user are operating on their own profile/auctions...');
    const userId = parseInt(res.locals.id, 10);
    const requestId = parseInt(req.params.id,10);
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
    const requestAuctionId = parseInt(req.params.id,10);
    try{
        const result = await auctions.getAnAuction(requestAuctionId);
        if(result[0].sellerId !== null){
            const sellerId = result[0].sellerId;
            const loggedInId = res.locals.id;
            if(sellerId === loggedInId){
               res.locals.seller_id = sellerId;
               next();
            }else{
               res.status( 403 ).send(`You are only allow to change your own auction's information`);
               return;
            }
        }else{
            res.status( 404 ).send(`Auction not found`);
            return;
        }
    }catch (err){
        res.status( 500 ).send( `ERROR getting seller id: ${ err }`);
    }
}

export {loggedIn, loggedInRequired, isUser, isSeller}