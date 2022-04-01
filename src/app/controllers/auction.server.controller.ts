import Logger from "../../config/logger";
import {Request, Response} from "express";
import * as validation from '../middleware/validation';
import {getAnAuction} from "../models/auction.server.model";
import * as auctions from '../models/auction.server.model';
import * as fs from "fs";

// ——————————————————————————————————CHECK————————————————————————————————————
const isThereAnyBids = async (auctionId: number, res: Response): Promise<any> =>{
    let bidNumber: number;
    try{
        const result = await auctions.getAnAuction(auctionId);
        if(result.length === 1){
            bidNumber = result[0].numBids;
            if (bidNumber > 0){
               return false;
            }
        }else{
            return true;
        }
    }catch(err){
       res.status( 500 ).send( `ERROR getting auction id:${auctionId}: ${err}` );
       return;
    }
}

const isAuctionExist = async (auctionId: number, res: Response): Promise<any> =>{
    try{
        const result = (await auctions.getAnAuction(auctionId));
        if(result.length !== 1){
            res.status(404).send(`Auction id: '${auctionId}' does not exist`);
            return;
        }
    }catch(err){
       res.status( 500 ).send( `ERROR getting auction id:${auctionId}: ${err}` );
       return;
    }
}

const isCategoryIdValid = async (categoryId: number,res:Response) : Promise<any> => {
    try{
        const result = await auctions.getCategory(categoryId);
        if(result !== null){
            return;
        }else{
            res.status( 404 ).send( `Category not found`);
            return;
        }
    }catch(err){
        res.status( 500 ).send( `ERROR getting category id:${categoryId}: ${err}`);
        return;
    }
}

// this bid must be higher than the most recent/current highest bid
const isBidAmountValid = async (bidAmount: number, auctionId: number,res: Response) : Promise<any> => {
    try{
        const result = await auctions.getHighestBidByAuction(auctionId);
        let highestRecentBid :number;
        if(result !== null){
            highestRecentBid = result;
        }else{
            highestRecentBid = 0;
        }
        return highestRecentBid < bidAmount;
    }catch(err){
        res.status( 500 ).send( `ERROR getting auction id:${auctionId} highest bid: ${err}`);
        return;
    }
}
// ——————————————————————————————POST Methods——————————————————————————————————
// create an auction with request body that follows the `auction` schema definition
const createAuction = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Create an auction with information`);
    const userId = res.locals.id;
    // check if request body are qualified
    const title = req.body.title;
    let auctionDetails = [];
    if (!await validation.isNameValid(title)){
        res.status(400).send("'title' has to be 'string' , minimum length of names is 1");
        return;
    }else{
        try{
            const result = await auctions.getAuctionByTitle(title);
            if(result === 1){
                res.status(400).send(`There is an auction has title '${title}', please use another title`)
            }
        }catch(err){
            res.status( 500 ).send( `ERROR get auction by title: ${title}: ${ err }`);
        }
    }
    if(!req.body.hasOwnProperty('description') || !req.body.hasOwnProperty('categoryId') || !req.body.hasOwnProperty('endDate')){
        res.status(400).send("Description, endDate and categoryId are required");
        return;
    }else{
        const description = req.body.description;
        const endDate = req.body.endDate;
        const categoryId = req.body.categoryId;
        let reserve = 1; // If no reserve price is specified it will automatically be set to 1
        await isCategoryIdValid(categoryId, res);
        if (!await validation.isDescriptionValid(description)){
            res.status(400).send("'description' has to be 'string'");
            return;
        }if(!await validation.isEndDateValid(endDate)){
            res.status(400).send("'endDate' must be in the future");
            return;
        }else{
            auctionDetails = [title, description, categoryId, endDate, userId];
            if(req.body.hasOwnProperty('reserve')){
                reserve = req.body.reserve;
                if(!await validation.isReserveValid(reserve)){
                    res.status(400).send("'reserve' has to be a 'number', minimum is 1");
                    return;
            }else{
                    auctionDetails.push(reserve);
                }
            }
        }
    }
    // if all requested parameters are qualified, then query
    try {
        const result = await auctions.createAnAuction(auctionDetails);
        res.status( 201 ).send(result);
    } catch( err ) {
        res.status( 500 ).send( `ERROR creating auction ${title}: ${err}` );
        return;
    }
};// 201,400,401,500

// create a bid with request body `amount`
// Authentication required
const addBid = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Put auction bid`);
    const auctionId = parseInt(req.params.id, 10);
    const userId = res.locals.id;
    // check if request auction exist in database, if not 404
    await isAuctionExist(auctionId,res);
    let bidAmount: number;
    if (!req.body.hasOwnProperty('amount')) {
        res.status(400).send('bid amount can not be empty');
        return;
    } else {
        bidAmount = parseInt(req.body.amount, 10);
        if (!await isBidAmountValid(bidAmount, auctionId, res)) {
            res.status(403).send('bid must be higher than the most recent/current highest bid');
            return;
        }
    }
    try {
        // A UTC datetime expressed in ISO8601 format (yyyy-MM-ddThh:mm:ss.sssZ)
        // MySQL retrieves and displays DATETIME values in 'YYYY-MM-DD hh:mm:ss' format
        const now = new Date();
        // summer time problem, which is one hour late than normal time, winter time has to change back(comment out this line)
        // https://stackoverflow.com/questions/32469269/javascript-date-give-wrong-date-off-by-one-hour
        now.setTime(now.getTime() - new Date().getTimezoneOffset() * 60 * 1000);
        const timeString = now.toISOString();
        // manually convert ISO8601 format to SQL DATETIME
        const timestamp = timeString.replace('T', ' ').replace('Z', '').substring(0, timeString.length - 5)
        await auctions.updateAuctionBids(auctionId, userId, bidAmount, timestamp);
        res.status(201).send();
    } catch (err) {
        res.status(500).send(`ERROR place bid for auction id: ${auctionId}: ${err}`);
    }
};

// ——————————————————————————————GET Methods——————————————————————————————————
// get a list of auctions that related with give request parameters
const getAuctionList = async (req:any, res:any) : Promise<any> => {
    // By default, the auctions should be sorted by the closing date of the auctions.
    // The list should be filtered, then sorted, then paginated using startIndex and count.
    // The returned object should include the total number of auctions that match the search criteria,
    // which may differ from the number returned by the query (this is for client pagination)
    const whereParams : {[key:string]: string|number} = {};
    const keywords : string[] = [];
    const categoryList : number[] = [];
    let sortBy : string = '';
    let count : number = 0;
    let startIndex : number = 0;
    Logger.http(`GET all auctions`);
    if(req.query.hasOwnProperty('q')){
        keywords.push(req.query.q);
    }
    if(req.query.hasOwnProperty('categoryIds')){
        const pList : number[] = [];
        // check if categoryIds is an array, if so, check each element is valid to convert to number
        // push qualified element to pList
        if(Array.isArray(req.query.categoryIds)){
            for (const p of req.query.categoryIds) {
                if(await validation.isParseIntParamValid(p)){
                    pList.push(parseInt(p,10));
                }
            }
            if(pList.length === 0){
                    res.status(400).send("category id should in 'number' type")
                }
        }else{ // if not an array, check if the single element is a number, if ok, push to pList
            if(await validation.isParseIntParamValid(req.query.categoryIds)){
                pList.push(parseInt(req.query.categoryIds,10));
            }
        }
        // for each category number check if it is a valid category number(exist in category list)
        for (const p of pList) {
            const result = await isCategoryIdValid(p,res)
            if(result === true){
               categoryList.push(p);
            }
        }
    }
    if(req.query.hasOwnProperty('sellerId')){
        if(!await validation.isParseIntParamValid(req.query.sellerId)){
           res.status(400).send("sellerId should in 'number' type");
        }else{
            whereParams.seller_id = parseInt(req.query.sellerId,10);
        }
    }
    // Sort the auctions by the given property, according to the following rules:
    // * ALPHABETICAL_ASC: alphabetically by title,A - Z
    // * ALPHABETICAL_DESC: alphabetically by title,Z - A
    // * CLOSING_SOON: date, from end date earliest to latest
    // * CLOSING_LAST: date, from end date latest to earliest
    // * BIDS_ASC: the current bid, from least to most
    // * BIDS_DESC: the current, from most to least
    // * RESERVE_ASC: the reserve price from lowest to highest
    // * RESERVE_DESC: the reserve price from highest to lowest
    // Available values : ALPHABETICAL_ASC, ALPHABETICAL_DESC, BIDS_ASC, BIDS_DESC,
    // CLOSING_SOON, CLOSING_LAST, RESERVE_ASC, RESERVE_DESC
    // Default value : CLOSING_SOON
    if(req.query.hasOwnProperty('sortBy')){
        const sortByParam = req.query.sortBy;
        switch (sortByParam){
            case 'ALPHABETICAL_ASC':
                sortBy = 'title ASC';
                break;
            case 'ALPHABETICAL_DESC':
                sortBy = 'title DESC';
                break;
            case 'CLOSING_SOON':
                sortBy = 'end_date ASC';
                break;
            case 'CLOSING_LAST':
                sortBy = 'end_date DESC';
                break;
            case 'BIDS_ASC':
                sortBy = 'timestamp ASC';
                break;
            case 'BIDS_DESC':
                sortBy = 'timestamp DESC';
                break;
            case 'RESERVE_ASC':
                sortBy = 'reserve ASC';
                break;
            case 'RESERVE_DESC':
                sortBy = 'reserve DESC';
                break;
        }
    }else{
        sortBy = 'end_date ASC'
    }
    if(req.query.count === undefined){
        count = 0;
    }else{
        if(!await validation.isParseIntParamValid(req.query.count)){
            res.status(400).send("count should in 'number' type");
        }else{
            count = parseInt(req.query.count,10);
        }
    }
    if (req.query.startIndex === undefined){
        startIndex = 0
    }else{
        if(!await validation.isParseIntParamValid(req.query.startIndex)){
            res.status(400).send("startIndex should in 'number' type");
        }else{
            startIndex = parseInt(req.query.startIndex, 10);
        }
    }
    if(req.query.hasOwnProperty('bidderId')){
        if(!(await validation.isParseIntParamValid(req.query.bidderId))){
            res.status(400).send("bidderId should in 'number' type");
        }else{
            whereParams.user_id = parseInt(req.query.bidderId,10);
        }
    }
    try {
        const result = await auctions.getAllAuctions(keywords, whereParams,categoryList,sortBy,count,startIndex);
        res.status( 200 ).json( result );

    } catch( err ) {
        res.status( 500 )
        .send( `ERROR getting users ${ err }` );
    }
};

// get an auction with give request parameter: auction id
const getAuction = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`GET single auction id: ${req.params.id}`);
    const auctionId = parseInt(req.params.id,10);
    // check if request auction exist in database, if not 404
    await isAuctionExist(auctionId,res);
    try {const result = await auctions.getAnAuction(auctionId);
        if( result === null ){
            res.status( 404 ).send('Auction not found');
        } else {
            res.status( 200 ).send( result );
    }
    } catch( err ) {
        res.status( 500 ).send( `ERROR reading auction ${auctionId}: ${ err }`
    );
    }
};// 200,404,500

// Retrieve list of all categories with categoryId and name values
const listCategory = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Retrieve all data about auction categories`);
    try {
        const result = await auctions.getAllCategory();
        if( result === null ){
            res.status( 404 ).json( result );
        } else {
            res.status( 200 ).json( result );
        }
    } catch( err ) {
        res.status( 500 ).send( `ERROR retrieving category list}: ${ err }`
    );
    }
};

// get all bids of an auction with given request parameter: auciton id
const getAuctionBids = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`GET auction id: ${req.params.id}'s bids`);
    const id = req.params.id;
    try {
        const result = await auctions.getAnAuctionBids( parseInt(id, 10) );
        if( result === null ){
            res.status( 404 ).json( result );
        } else {
            res.status( 200 ).json( result );
        }
    } catch( err ) {
        res.status( 500 ).send( `ERROR reading auction bid ${id}: ${ err }`);
    }
};

// ——————————————————————————————PUT Methods——————————————————————————————————
// update an auction with given request parameter: auction id and contents in request body
// Authentication required
const changeAuction = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Change an auction id: ${req.params.id}'s details`);
    const auctionId = parseInt(req.params.id,10);
    try{
        const result = await getAnAuction(auctionId);
        if (result === null){
            res.status( 404 ).send('Auction not found');
        }
    }catch(err){
        res.status( 500 ).send( `ERROR reading auction ${auctionId}: ${ err }`)
    }
    const auctionChangeList : { [key:string]:string } = {};
    // Not accessible after a bid has been placed.
    if(!await isThereAnyBids(auctionId,res)){
        // If updated, the categoryId must reference an existing category.
        if (req.body.hasOwnProperty('categoryId')){
          const categoryId = req.body.categoryId;
          if(!await isCategoryIdValid(categoryId,res)){
                res.status(400).send("'categoryId' must reference an existing category");
                return;
          }else{
              auctionChangeList.category_id = (categoryId);
          }
        }
        if(req.body.hasOwnProperty('title')){
            const title = req.body.title;
            if (!await validation.isNameValid(title)){
            res.status(400).send("'title' has to be 'string' , minimum length of names is 1");
            return;
            }else{
               auctionChangeList.title = title;
            }
        }
        if(req.body.hasOwnProperty('description')){
            const description = req.body.description;
            if (!await validation.isDescriptionValid(description)){
                res.status(400).send("'description' has to be 'string'");
                return;
            }else{
                auctionChangeList.description = description;
            }
        }
        if(req.body.hasOwnProperty('endDate')){
            const endDate = req.body.endDate;
            if(!await validation.isEndDateValid(endDate)){
                res.status(400).send("'endDate' must be in the future");
                return;
            }else{
                auctionChangeList.end_date = endDate;
            }
        }
        if(req.body.hasOwnProperty('reserve')){
            const reserve = req.body.reserve;
            if(!await validation.isReserveValid(reserve)){
                        res.status(400).send("'reserve' has to be a 'number', minimum is 1");
                        return;
            }else{
                auctionChangeList.reserve = reserve;
            }
        }
        try {
            await auctions.updateAuctionDetails(auctionId, auctionChangeList);
            res.status( 200 ).send();
        } catch( err ) {
            res.status( 500 ).send( `ERROR updating auction ${auctionId}: ${ err }`);
        }
    }
};// 200,400,401,403,404,500

// ——————————————————————————————DELETE Methods——————————————————————————————————
// delete an auction with given request parameter: auction id
// Authentication required
const removeAuction = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Delete auction id: ${req.params.id}`);
    const auctionId = parseInt(req.params.id,10);
    try{
        const result = await getAnAuction(auctionId);
        if (result === null){
            res.status( 404 ).send('Auction not found');
        }
    }catch(err){
        res.status( 500 ).send( `ERROR reading auction ${auctionId}: ${ err }`)
    }
    // Not accessible after a bid has been placed.
    if(!await isThereAnyBids(auctionId,res)){
       try{
            await auctions.deleteAnAuction(auctionId);
            res.status( 200 ).send();
       }catch( err ) {
            res.status( 500 ).send( `ERROR deleting auction ${auctionId}: ${ err }`);
       }
    }else{
        res.status(403).send(`No changes may be made after a bid has been placed on an auction`);
        return;
    }
};

// ——————————————————————————————Auction Image——————————————————————————————————
// upload an image for an auction with given request parameter: auction id
// Authentication required
const setAuctionImage = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Set auction ${req.params.id}'s profile image`);
    const requestAuctionId = parseInt(req.params.id,10);
    try{
        const result = await getAnAuction(requestAuctionId);
        if (result === null){
            res.status( 404 ).send('Auction not found');
        }
    }catch(err){
        res.status( 500 ).send( `ERROR reading auction ${requestAuctionId}: ${ err }`)
    }
    const imageType = req.headers['content-type'].substring(6,).toLowerCase();
    // use express.raw({type}) to parse request body
    const imageBinary = req.body;
    let fileName : string = '';
    // check if image is the right type
    if(!await validation.isImageTypeValid(imageType)){
        res.status(400).send(`Image type not valid`);
        return;
    }
        // check if logged in user is requesting for checking his/her own detail
    const userId = res.locals.id;
    const sellerId = res.locals.seller_id;
    if(userId !== sellerId){
       res.status( 403 ).send('You are only allow to change your own profile image');
       return;
    }
    // check if request body is empty
    if (!imageBinary) {
        res.status(400).send(`Request image data content can not be empty.`);
        return;
    }// ----check end---
    try{
        fileName = 'auction_' + requestAuctionId.toString() + '.' + imageType;
        const filePath = 'storage/images/' + fileName;
        await fs.writeFileSync(filePath, imageBinary, 'binary');
    }catch(err){
        res.status(500).send(`fs writing ERROR: ${ err }`)
    }
    // check profile photo name by id
    let imageFileExist : boolean = false;
    try{
        const result = await auctions.getProfilePhotoById(requestAuctionId);
        imageFileExist = result !== null;
    }catch(err){
        res.status( 500 ).send( `ERROR get user's photo by id:${requestAuctionId} : ${ err }`);
    }
    try{
        await auctions.updateAuctionProfileImage(requestAuctionId,fileName);
        // If the user already has a profile photo,
        // the current profile photo will be replaced with it, and a 200 OK response will be sent
        if(imageFileExist){
           res.status( 200 ).send( 'Auction profile image updated' );
        }else{ // If not, a 201 Created response will be sent
            res.status( 201 ).send( 'Auction profile image created' );
        }
    }catch(err){
        res.status( 500 ).send( `ERROR creating/updating Auction ${requestAuctionId}: ${ err }`);
    }
};

// get the profile image of an auction with given request parameter: auction id
// Authentication required
const getAuctionImage = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Get auction id: ${req.params.id}'s profile photo`);
    const requestAuctionId = parseInt(req.params.id,10);
    // get profile image name by id
    let fileName :string = 'NULL';
    try{
        const result = await auctions.getAuctionProfileImage(requestAuctionId);
        if(result !== null){
            fileName = result;
        }else{
           res.status( 404 ).send('No image found');
        }
    }catch (err){
        res.status( 500 ).send( `ERROR getting user ${req.params.id}'s profile photo name: ${ err }`);
    }
    const filePath = 'storage/images/' + fileName;
    const fileType = fileName.split('.')[1];
    if(await validation.isImageTypeValid(fileType)){
        try{
            return res.status(200).attachment(filePath).send();
        }catch(err){
           res.status(500).send(`fs reading ERROR: ${ err }`);
        }
    }
};

export {getAuctionList,createAuction,getAuction,changeAuction,removeAuction,listCategory,
    getAuctionBids,addBid,getAuctionImage,setAuctionImage}