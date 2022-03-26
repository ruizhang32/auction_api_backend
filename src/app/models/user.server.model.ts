import { getPool } from "../../config/db";
import Logger from "../../config/logger";
import {ResultSetHeader} from "mysql2";

// ——————————————————————————————CHECK——————————————————————————————————
const getUserByEmail = async (email: string): Promise<any> =>{
    Logger.info( 'Getting USER with given email address from database...' );
    const conn = await getPool().getConnection();
    const query = `select count(*) as count from user where email = '${email}';`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

// for login
const getUserInfoByEmail = async (email: string) : Promise<User[]> => {
    Logger.info(`Authenticate user ${(email)} with the database`);
    const conn = await getPool().getConnection();
    const query = `select * from user where email = '${email}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

const getUserByToken = async (token: string): Promise<any> =>{
    Logger.info( 'Getting related EMAIL/ID by given token from database...' );
    const conn = await getPool().getConnection();
    const query = `select email,id from user where auth_token = '${token}';`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

const getProfilePhotoById = async (userId: number): Promise<any> =>{
    Logger.info( 'Getting profile IMAGE with related user id from database...' );
    const conn = await getPool().getConnection();
    const query = `select image_filename from user where id = '${userId}';`;
    const [ rows ] = await conn.query(query);
    conn.release();
    return rows;
}

// ——————————————————————————————INSERT Methods——————————————————————————————————
const createAnUser = async (firstName: string, lastName: string, email: string, encryptedPassword: string): Promise<ResultSetHeader> => {
    Logger.info(`Adding user ${(email)} to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into user(first_Name, last_Name, email, password) values (?)';
    const [ result ] = await conn.query( query, [[firstName, lastName, email, encryptedPassword]] );
    conn.release();
    return result;
}

// ——————————————————————————————SELECT Methods——————————————————————————————————
const getAnUser = async (id: number) : Promise<User[]> => {
    Logger.info(`Getting user ${id} from the database`);
    const conn = await getPool().getConnection();
    const query = `select * from user where id = '${id}'`;
    const [ rows ] = await conn.query( query );
    conn.release();
    return rows;
}

const getUserProfileImage = async (userId: number) : Promise<any> => {
    Logger.info(`Getting user ${userId}'s profile photo from the database`);
    const conn = await getPool().getConnection();
    const query = `select image_filename from user where id = '${userId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

// ——————————————————————————————UPDATE Methods——————————————————————————————————
// for login
const updateTokenInDB = async (email:string, token: string): Promise<any> => {
    Logger.info(`Update user ${(email)} token in database`);
    const conn = await getPool().getConnection();
    const query = `update user SET auth_token = '${token}' WHERE email = '${email}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

const updateUserDetails = async (userId: number, updateDetails: {}) : Promise<any> => {
    Logger.info(`Updating user ${userId}' information in the database`);
    const conn = await getPool().getConnection();
    let queryString = '';
    for (const [key, value] of Object.entries(updateDetails)) {
        if (value !== undefined) queryString += `${key} = '${value}',`
    }
    const finalQueryString = queryString.substring(0, queryString.length - 1);
    const finalQuery = `update user set ${finalQueryString} where id = ${userId}`;
    Logger.info(finalQuery);
    const [editUserRows] = await conn.query(finalQuery);
    conn.release();
    return editUserRows;
}

const logoutUser = async (email: string) : Promise<ResultSetHeader> => {
    Logger.info(`Logout user ${(email)}, deleting token from database`);
    const conn = await getPool().getConnection();
    const query = `update user SET auth_token = NULL WHERE email = '${email}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

const updateUserProfileImage = async (userId: number, fileName: string) : Promise<any> => {
    Logger.info(`Updating user ${userId}'s profile photo in the database`);
    const conn = await getPool().getConnection();
    const query = `update user SET image_filename = '${fileName}' WHERE id = '${userId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

// ——————————————————————————————DELETE Methods——————————————————————————————————
const deleteUserProfileImage = async (userId: number) : Promise<any> => {
    Logger.info(`Deleting user ${userId}'s profile photo from the database`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = NULL WHERE id = '${userId}'`;
    const [ result ] = await conn.query( query );
    conn.release();
    return result;
}

export {getUserByEmail,getUserByToken,getProfilePhotoById,createAnUser,getAnUser,
    updateUserDetails,getUserInfoByEmail,logoutUser,updateTokenInDB,getUserProfileImage,updateUserProfileImage,
    deleteUserProfileImage}