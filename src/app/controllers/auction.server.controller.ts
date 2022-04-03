import Logger from "../../config/logger";
import {Request, Response} from "express";
import * as validation from '../middleware/validation';
import * as auctions from '../models/auction.server.model';
import * as fs from "fs";

// ——————————————————————————————POST Methods——————————————————————————————————
// create an auction with request body that follows the `auction` schema definition
const createAuctionController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Create an auction with information`);
    const userId : number = res.locals.id;
    // check if request body are qualified
        // check if auction description/categoryId/endDate provided in request body are valid
    if(!req.body.hasOwnProperty('title') || !req.body.hasOwnProperty('description') ||
        !req.body.hasOwnProperty('categoryId') || !req.body.hasOwnProperty('endDate')){
        res.status(400).send("Title, description, endDate and categoryId are required for creating an auction");
        return;
    }
    const title : string = req.body.title;
    const description = req.body.description;
    const endDate = req.body.endDate;
    const categoryId = req.body.categoryId;
    let reserve: number = 1; // If no reserve price is specified it will automatically be set to 1
    // check if auction name provided in request body is valid
    if (!await validation.isNameSchemaValid(title)){
        res.status(400).send("auction 'title' has to be 'string' , minimum length is 1");
        return;
    }
    else{
        try{
            const titleExists = await auctions.doesAuctionTitleExist(title);
            if(titleExists){
                res.status(400).send(`Auction title '${title}' already been used, please use another title`);
                return;
            }
        }catch(err){
            res.status( 500 ).send( `ERROR get auction by auction title: ${title}: ${ err }`);
            return;
        }
    }
    let categoryIdValid : boolean;
    try{
        categoryIdValid = await validation.isCategoryIdValid(categoryId);
    }catch (err){
        res.status( 500 ).send( `ERROR getting category id:${categoryId}: ${err}`);
        return;
    }
    if (categoryIdValid){
        if (!await validation.isDescriptionSchemaValid(description)){
            res.status(400).send("'description' has to be 'string'");
            return;
        }
        if(!await validation.isEndDateSchemaValid(endDate)){
            res.status(400).send("Invalid 'endDate'");
            return;
        }
        else{
            if(req.body.hasOwnProperty('reserve')){
                reserve = req.body.reserve;
                if(!await validation.isReserveSchemaValid(reserve)){
                    res.status(400).send("'reserve' has to be a 'number', minimum is 1");
                    return;
                }
            }
            // else reserve = 1
        }
    }
    else{
        res.status(400).send("'categoryId' must reference an existing category");
        return;
    }
    // if all requested parameters are qualified, then query
    try {
        const result = await auctions.createAuctionModel(title, description, categoryId, endDate, userId, reserve);
        res.status( 201 ).send({"auctionId": result} );
        return;
    } catch( err ) {
        res.status( 500 ).send( `ERROR creating an auction ${title} in database : ${err}` );
        return;
    }
};// 201,400,401,500

// create a bid with request body `amount`
// Authentication required
const addBidController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Place an auction bid`);
    let requestAuctionId: number;
    if(await validation.isParseIntParamValid(req.params.id)){
        requestAuctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send('Auction Id should be a number');
        return;
    }
    const userId : number = res.locals.id;
    let bidAmount: number;
    if(req.body.hasOwnProperty('amount') && await validation.isParseIntParamValid(req.body.amount))
         bidAmount = parseInt(req.body.amount, 10);
    else{
        res.status(400).send('Bid Amount should be a number');
        return;
    }
    // bid must be higher than the most recent/current highest bid
    let bidAmountValid : boolean;
    try{
        bidAmountValid = await validation.isBidAmountValid(bidAmount, requestAuctionId);
    }catch (err){
        res.status(500).send(`No bid found for this auction id: ${requestAuctionId}`);
        return;
    }
    if (!bidAmountValid) {
        res.status(403).send('bid must be higher than the most recent/current highest bid');
        return;
    }
    // A UTC datetime expressed in ISO8601 format (yyyy-MM-ddThh:mm:ss.sssZ)
    // MySQL retrieves and displays DATETIME values in 'YYYY-MM-DD hh:mm:ss' format
    const now = new Date();
    // summer time problem, which is one hour late than normal time, winter time has to change back(comment out this line)
    // https://stackoverflow.com/questions/32469269/javascript-date-give-wrong-date-off-by-one-hour
    // now.setTime(now.getTime() - new Date().getTimezoneOffset() * 60 * 1000);
    const timeString = now.toISOString();
    // manually convert ISO8601 format to SQL DATETIME
    const timestamp = timeString.replace('T', ' ').replace('Z', '').substring(0, timeString.length - 5);
    try {
        await auctions.addBidModel(requestAuctionId, userId, bidAmount, timestamp);
        res.status(201).send();
        return;
    } catch (err) {
        if(err.name === 'auctionIdErr'){
            res.status(404).send(`${err}`);
        }
        else {
            res.status(500).send(`ERROR place bid for an auction from database, id: ${requestAuctionId}: ${err}`);
        }
        return;
    }
};

// ——————————————————————————————GET Methods——————————————————————————————————
// get a list of auctions that related with give request parameters
const getAllAuctionsController = async (req:any, res:any) : Promise<void> => {
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
        const paramList : number[] = [];
        // check if there are multiple categoryId(query params of categoryId is an array), if so, check each category is valid to convert to number
        // push qualified element to paramList
        if(Array.isArray(req.query.categoryIds)){
            for (const p of req.query.categoryIds) {
                if(await validation.isParseIntParamValid(p)){
                    paramList.push(parseInt(p,10));
                }
                else{
                    res.status(400).send('Category Id(s) should be a number')
                }
            }
            if(paramList.length === 0){
               res.status(400).send("category id should in 'number' type");
               return;
            }
        }else{ // if not an array, check if the single element is a number, if yes, push to paramList
            if(await validation.isParseIntParamValid(req.query.categoryIds)){
                paramList.push(parseInt(req.query.categoryIds,10));
            }
            else{
                res.status(400).send('Category Id(s) should be a number')
            }
        }
        // for each category number check if it is a valid category number(exist in category list)
        let categoryIdValid : boolean;
        for (const p of paramList) {
            try{
                categoryIdValid = await validation.isCategoryIdValid(p);
            }catch (err){
                res.status( 500 ).send( `ERROR getting category id:${p}: ${err}`);
                return;
            }
            if(categoryIdValid === true){
               categoryList.push(p);
            }
            else{
                res.status(400).send("'categoryId' must reference an existing category");
                return;
            }
        }
    }
    if(req.query.hasOwnProperty('sellerId')){
        if(!await validation.isParseIntParamValid(req.query.sellerId)){
           res.status(400).send("sellerId should in 'number' type");
           return;
        }
        else{
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
    }
    else{
        sortBy = 'end_date ASC'
    }
    if(req.query.count === undefined){
        count = 0;
    }
    else{
        if(!await validation.isParseIntParamValid(req.query.count)){
            res.status(400).send("count should in 'number' type");
            return;
        }
        else{
            count = parseInt(req.query.count,10);
        }
    }
    if (req.query.startIndex === undefined){
        startIndex = 0
    }
    else{
        if(!await validation.isParseIntParamValid(req.query.startIndex)){
            res.status(400).send("startIndex should in 'number' type");
            return;
        }
        else{
            startIndex = parseInt(req.query.startIndex, 10);
        }
    }
    if(req.query.hasOwnProperty('bidderId')){
        if(!(await validation.isParseIntParamValid(req.query.bidderId))){
            res.status(400).send("bidderId should in 'number' type");
            return;
        }
        else{
            whereParams.user_id = parseInt(req.query.bidderId,10);
        }
    }
    try {
        const result = await auctions.getAllAuctionsModel(keywords, whereParams,categoryList,sortBy,count,startIndex);
        res.status( 200 ).json( result );
        return;
    } catch( err ) {
        res.status( 500 ).send( `ERROR getting auctions from database${ err }` );
        return;
    }
};

// get an auction with give request parameter: auction id
const getSingleAuctionController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`GET single auction id: ${req.params.id}`);
    let auctionId;
    if(await validation.isParseIntParamValid(req.params.id)){
        auctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send(`Auction id should be 'number' type`);
    }
    try {
        const result = await auctions.getSingleAuctionModel(auctionId);
        res.status( 200 ).send( result );
        return;
    }
    catch( err ) {
        if(err.name === 'auctionIdErr'){
            res.status(404).send(`${err}`);
        }else{
            res.status( 500 ).send( `ERROR reading auction ${auctionId}: ${ err }`);
        }
        return;
    }
};// 200,404,500

// Retrieve list of all categories with categoryId and name values
const getAllCategoriesController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Retrieve all data about auction categories`);
    try {
        const result = await auctions.getAllCategoriesModel();
        res.status( 200 ).json( result );
        return;
    } catch( err ) {
        res.status( 500 ).send( `ERROR retrieving category list from database: ${ err }`);
        return;
    }
};// 200,500

// get all bids of an auction with given request parameter: auction id
const getAllAuctionBidsController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`GET auction id: ${req.params.id}'s bids`);
    const auctionIdString = req.params.id;
    let auctionId : number;
    let auctionExist : boolean;
    if(await validation.isParseIntParamValid(auctionIdString)){
        auctionId = parseInt(auctionIdString, 10);
    }else{
        res.status(400).send('Auction Id should be a number');
        return;
    }
    try{
        auctionExist = await validation.doesAuctionExist(auctionId);
    }
    catch (err){
        if(err.name === 'auctionIdErr'){
            res.status(404).send('Auction not found');
        }
        else{
            res.status( 500 ).send( `ERROR getting auction id:${auctionId}: ${err}` );
        }
        return;
    }
    if(auctionExist){
        try {
            const result = await auctions.getAllAuctionBidsModel( auctionId );
            if( result === [] ){
                res.status( 404 ).send( 'No bid for this auction' );
                return;
            } else {
                res.status( 200 ).json( result );
                return;
            }
        } catch( err ) {
            res.status( 500 ).send( `ERROR reading auction bid ${auctionId} from database: ${ err }`);
        }
    }
    else{
        res.status(404).send(`Auction id: '${auctionId}' does not exist in database`);
        return;
    }
};// 200,404,500

// ——————————————————————————————PUT Methods——————————————————————————————————
// update an auction with given request parameter: auction id and contents in request body
// Authentication required
const updateAnAuctionController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Update an auction id: ${req.params.id}'s details`);
    let auctionId;
    if(await validation.isParseIntParamValid(req.params.id)){
        auctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send(`Auction id should be 'number' type`);
    }
    const auctionChangeList : { [key:string]:string } = {};
    // Not accessible after a bid has been placed.
    try {
        if (!await validation.anyBid(auctionId)) {
            // If updated, the categoryId must reference an existing category.
            if (req.body.hasOwnProperty('categoryId')) {
                const categoryIdString : string = req.body.categoryId;
                let categoryId : number;
                if(await validation.isParseIntParamValid(categoryIdString)){
                    categoryId = parseInt(categoryIdString, 10);
                }else{
                    res.status(400).send('Category Id(s) should be a number');
                    return;
                }
                const categoryIdValid : boolean = await validation.isCategoryIdValid(categoryId);
                if (!categoryIdValid) {
                    res.status(400).send("'categoryId' must reference an existing category");
                    return;
                } else {
                    auctionChangeList.category_id = (categoryIdString);
                }
            }
            if (req.body.hasOwnProperty('title')) {
                const title :string = req.body.title;
                if (!await validation.isNameSchemaValid(title)) {
                    res.status(400).send("Auction 'title' has to be 'string' , minimum length of names is 1");
                    return;
                } else {
                    auctionChangeList.title = title;
                }
            }
            if (req.body.hasOwnProperty('description')) {
                const description : string = req.body.description;
                if (!await validation.isDescriptionSchemaValid(description)) {
                    res.status(400).send("Auction 'description' has to be 'string'");
                    return;
                } else {
                    auctionChangeList.description = description;
                }
            }
            if (req.body.hasOwnProperty('endDate')) {
                const endDate : string = req.body.endDate;
                if (!await validation.isEndDateSchemaValid(endDate)) {
                    res.status(400).send('Invalid endDate');
                    return;
                } else {
                    auctionChangeList.end_date = endDate;
                }
            }
            if (req.body.hasOwnProperty('reserve')) {
                const reserve = req.body.reserve;
                if (!await validation.isReserveSchemaValid(reserve)) {
                    res.status(400).send("'reserve' has to be a 'number', minimum is 1");
                    return;
                } else {
                    auctionChangeList.reserve = reserve;
                }
            }
            // check if request body is empty
            if (Object.keys(auctionChangeList).length === 0) {
                res.status(400).send("Update content can not be empty");
                return;
            } else {
                await auctions.updateAnAuctionModel(auctionId, auctionChangeList);
                res.status(200).send();
                return;
            }
        } else {
            res.status(403).send(`No changes may be made after a bid has been placed on an auction`);
            return;
        }
    }catch (err){
        if(err.name === 'auctionIdErr')
            res.status(404).send(`${err}`);
        else{
            res.status( 500 ).send( `Server Error changing auction ${auctionId}: ${ err }`);
        }
        return;
    }
};// 200,400,401,403,404,500

// ——————————————————————————————DELETE Methods——————————————————————————————————
// delete an auction with given request parameter: auction id
// Authentication required
const deleteAnAuctionController = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Delete auction id: ${req.params.id}`);
    let auctionId;
    if(await validation.isParseIntParamValid(req.params.id)){
        auctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send(`Auction id should be 'number' type`);
    }
    // Not accessible after a bid has been placed.
    try{
        if(!await validation.anyBid(auctionId)){
            await auctions.deleteAnAuctionModel(auctionId);
            res.status( 200 ).send();
            return;
        }else{
            // according to API specification, attempt to make change after bidding return 403
            res.status(403).send(`No changes may be made after a bid has been placed on an auction`);
            return;
        }
    }catch( err ) {
        res.status( 500 ).send( `Server Error deleting auction ${auctionId}: ${ err }`);
        return;
    }
};

// ——————————————————————————————Auction Image——————————————————————————————————
// upload an image for an auction with given request parameter: auction id
// Authentication required
const setAuctionImage = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Set auction ${req.params.id}'s profile image`);
    let requestAuctionId;
    if(await validation.isParseIntParamValid(req.params.id)){
        requestAuctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send(`Auction id should be 'number' type`);
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
    const userId : number = res.locals.id;
    const sellerId : number = res.locals.seller_id;
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
        const filePath :string = 'storage/images/' + fileName;
        await fs.writeFileSync(filePath, imageBinary, 'binary');
    }catch(err){
        res.status(500).send(`fs writing ERROR: ${ err }`);
        return;
    }
    // check profile photo name by id
    let imageFileExist : boolean = false;
    try{
        const result = await auctions.getProfilePhotoById(requestAuctionId);
        imageFileExist = result !== null;
        await auctions.updateAuctionProfileImage(requestAuctionId,fileName);
        // If the user already has a profile photo,
        // the current profile photo will be replaced with it, and a 200 OK response will be sent
        if(imageFileExist){
           res.status( 200 ).send( 'Auction profile image updated' );
           return;
        }else{ // If not, a 201 Created response will be sent
            res.status( 201 ).send( 'Auction profile image created' );
            return;
        }
    }catch(err){
        if(err.name === 'auctionIdErr'){
            res.status(404).send(`${err}`);
        }
        else{
            res.status( 500 ).send( `ERROR creating/updating Auction ${requestAuctionId}: ${ err }`);
        }
        return;
    }
};

// get the profile image of an auction with given request parameter: auction id
// Authentication required
const getAuctionProfileImageController = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Get auction id: ${req.params.id}'s profile photo`);
    let requestAuctionId: number;
    if(await validation.isParseIntParamValid(req.params.id)){
        requestAuctionId = parseInt(req.params.id,10);
    }
    else{
        res.status(400).send('Auction Id should be a number');
        return;
    }
    // get profile image name by id
    let fileName :string = 'NULL';
    try{
        const result = await auctions.getAuctionProfileImageModel(requestAuctionId);
        if(result !== null){
            fileName = result;
        }
    }catch (err){
        if(err.name === 'auctionIdErr'){
            res.status( 404 ).send('No image found');
        }
        else{
            res.status( 500 ).send( `ERROR getting auction ${req.params.id}'s photo from database: ${ err }`);
        }
        return;
    }
    const filePath = 'storage/images/' + fileName;
    const fileType = fileName.split('.')[1];
    if(await validation.isImageTypeValid(fileType)){
        try{
            res.status(200).attachment(filePath).send();
            return;
        }catch(err){
           res.status(500).send(`fs reading ERROR: ${ err }`);
           return;
        }
    }
};

export {getAllAuctionsController,createAuctionController,getSingleAuctionController,updateAnAuctionController,deleteAnAuctionController,getAllCategoriesController,
    getAllAuctionBidsController,addBidController,getAuctionProfileImageController,setAuctionImage}