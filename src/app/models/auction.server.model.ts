import {ResultSetHeader} from "mysql2";
import {getPool} from "../../config/db";
import Logger from "../../config/logger";

// ——————————————————————————————CHECK——————————————————————————————————
// for checking if category is in the category list
const getCategory= async (categoryId: number) : Promise<Category[]> => {
    Logger.info(`Checking if category_id is in category list in the database`);
    const conn = await getPool().getConnection();
    const query = `select * from category where id = ${categoryId}`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

const getHighestBidByAuction= async (auctionId: number) : Promise<any> => {
    Logger.info(`Get the highest recent bid by auction from database`);
    const conn = await getPool().getConnection();
    const query = `select max(amount) as highestRecentBid from auction_bid where auction_id = '${auctionId}' order by timestamp`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

const getProfilePhotoById = async (auctionId: number): Promise<any> =>{
    Logger.info( 'Getting profile IMAGE with related auction id from database...' );
    const conn = await getPool().getConnection();
    const query = `select image_filename from auction where id = '${auctionId}';`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

const getAuctionByTitle = async (title: string): Promise<any> =>{
    Logger.info( 'Getting an auction with related auction title from database...' );
    const conn = await getPool().getConnection();
    const query = `select * from auction where title = '${title}';`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}


// ——————————————————————————————SELECT Methods——————————————————————————————————
const getAllAuctions = async (keywords:string[], whereParams:{[key:string]:string|number}, categoryList:number[], sortBy:string, count:number, startIndex: number) :
    Promise<Auction[]> => {
    Logger.info( 'Getting action list with related parameters from database...' );
    const conn = await getPool().getConnection();
    let finalQueryString = 'SELECT DISTINCT(auction.id) as auctionId,title,category_id as categoryId,seller_id as sellerId,user.first_name AS sellerFirstName,' +
        'user.last_name AS sellerLastName,reserve,COUNT(auction_bid.id) AS numBids,MAX(auction_bid.amount) AS highestBid,' +
        'end_date as endDate,description ' +
        'FROM auction ' +
        'INNER JOIN user ON user.id = auction.seller_id ' +
        'LEFT JOIN auction_bid ON auction_bid.auction_id = auction.id ';
    let whereQueryString: string = '';
    let keywordQueryString: string = '';
    let categoryQueryString: string = '';
    const temp : string[] = [];
    if(Object.keys(whereParams).length !== 0){
        const whereQuery: string[] = []
        for (const [key, value] of Object.entries(whereParams)) {
            whereQuery.push(`${key} = ${value}`);
        }
        whereQueryString = whereQuery.join(' and ');
        temp.push(whereQueryString);
    }
    if(keywords.length !== 0){
        for(const keyword of keywords){
            keywordQueryString += ` title like '%${keyword}%' or description like '%${keyword}%'`
        }
        temp.push(keywordQueryString);
    }
    if(categoryList.length !== 0){
        for(const category of categoryList){
            categoryQueryString += ` category_id = ${category} or `
        }
        const categoryQueryString1 = categoryQueryString.substring(0,categoryQueryString.length-3);
        temp.push(categoryQueryString1);
    }
    if(temp.length !== 0){
        finalQueryString += ' WHERE ';
        finalQueryString += temp.join(' AND ');
    }
    // if(!(temp.length === 0 && count === 0 && startIndex === 0)){
        const groupByQueryString =
            'GROUP BY auction.id,title,category_id,seller_id,user.first_name,user.last_name,reserve,end_date,description';
        const sortQueryString = `order by ${sortBy}`;
        finalQueryString += ' ' + groupByQueryString;
        finalQueryString += ' ' + sortQueryString;
    // }
    if(count !== 0 || startIndex !== 0){
        const limitQueryString = `LIMIT ${count} OFFSET ${startIndex}`;
        finalQueryString += ' ' + limitQueryString;
    }
    Logger.info(finalQueryString);
    const [ rows ] = await conn.query( finalQueryString );
    conn.release();
    return rows;
}

const getAnAuction = async (auctionId: number) : Promise<Auction[]> => {
    Logger.info(`Getting auction ${auctionId} from the database`);
    const conn = await getPool().getConnection();
    const query = 'SELECT auction.id as auctionId, title, category_id as categoryId,seller_id as sellerId,' +
        'user.first_name as sellerFirstName, ' +
        'user.last_name as sellerLastName, reserve, count(auction_bid.id) as numBids, max(auction_bid.amount) as highestBid, ' +
        'end_date as endDate, description FROM auction ' +
        'LEFT JOIN user ON user.id = auction.seller_id ' +
        'LEFT JOIN auction_bid ON auction_bid.auction_id = auction.id ' +
        `WHERE auction.id = ${auctionId}`;
    const [ rows ] = await conn.query( query );
    conn.release();
    return rows;
}


const getAllCategory = async () : Promise<Category[]> => {
    Logger.info(`Getting category from the database`);
    const conn = await getPool().getConnection();
    const query = 'select * from category';
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

const getAnAuctionBids = async (auctionId: number) : Promise<Auction[]> => {
    Logger.info(`Getting bid from the database`);
    const conn = await getPool().getConnection();
    const query =
        `select auction_bid.id as bidderId, amount, user.first_name as firstName, user.last_name as lastName, timestamp ` +
        `from auction_bid inner join user on auction_bid.user_id = user.id where auction_bid.auction_id = ${auctionId}
         Order by amount DESC, timestamp DESC`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

// ——————————————————————————————INSERT Methods——————————————————————————————————
const createAuction = async (auctionDetails: string[]) : Promise<ResultSetHeader> => {
    Logger.info(`Adding an auction to the database`);
    const conn = await getPool().getConnection();
    let query: string;
    if (auctionDetails.length === 5){
        query = 'insert into auction (title, description, category_id, end_date, seller_id) values (?)';
    }else{
        query = 'insert into auction (title, description, category_id, end_date, seller_id, reserve) values (?)';
    }
    const [ result ] = await conn.query( query, [auctionDetails] );
    conn.release();
    return result;
}

// Place a bid on auction
const updateAuctionBids = async (auctionId: number, buyerId: number, bidAmount: number, timestamp: string) : Promise<Auction[]> => {
    Logger.info(`Place a bid on auction id: '${auctionId}' to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into auction_bid (auction_id,user_id,amount,timestamp) values (?)';
    const [ result ] = await conn.query( query, [[auctionId,buyerId,bidAmount,timestamp]] );
    conn.release();
    return result;
}

// ——————————————————————————————UPDATE Methods——————————————————————————————————
const updateAuctionDetails = async (auctionId: number, auctionChangeList: {[key:string]: string}) : Promise<any> => {
    Logger.info(`Changing auction ${auctionId}'s detail(s) from the database`);
    const conn = await getPool().getConnection();
    let queryString = '';
    for (const [key, value] of Object.entries(auctionChangeList)) {
        if (value !== undefined) queryString += `${key} = '${value}',`
    }
    const finalQueryString = queryString.substring(0, queryString.length - 1);
    const finalQuery = `update auction set ${finalQueryString} where id = ${auctionId}`;
    const [editAuctionRows] = await conn.query(finalQuery);
    conn.release();
    return editAuctionRows;
}

// ——————————————————————————————DELETE Methods——————————————————————————————————
const deleteAnAuction = async (auctionId: number) : Promise<any> => {
    Logger.info(`Deleting auction ${auctionId} from the database`);
    const conn = await getPool().getConnection();
    const query = `DELETE FROM auction WHERE id = '${auctionId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

// ——————————————————————————————IMAGE Methods——————————————————————————————————
const getAuctionProfileImage = async (auctionId: number) : Promise<Auction[]> => {
    Logger.info(`Getting auction ${auctionId}'s profile photo from the database`);
    const conn = await getPool().getConnection();
    const query = `select image_filename from auction where id = '${auctionId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

const updateAuctionProfileImage = async (auctionId: number, fileName:string) : Promise<Auction[]> => {
    Logger.info(`Updating auction ${auctionId}'s profile photo in the database`);
    const conn = await getPool().getConnection();
    const query = `update auction SET image_filename = '${fileName}' WHERE id = '${auctionId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}


export {getProfilePhotoById, getHighestBidByAuction, getAuctionByTitle, getCategory, getAllAuctions,createAuction,getAnAuction,
    updateAuctionDetails, deleteAnAuction,getAllCategory,getAnAuctionBids,updateAuctionBids,getAuctionProfileImage,
    updateAuctionProfileImage}