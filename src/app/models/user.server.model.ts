import {getPool} from "../../config/db";
import Logger from "../../config/logger";

// ——————————————————————————————HELPER——————————————————————————————————
const getPasswordById = async (requestId: number): Promise<any> =>{
    Logger.info( 'Getting USER with given email address from database...' );
    const query = `select password from user where id = '${requestId}';`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
        return result[0].password;
    }
    else{
        const userIdErr: Error = new Error();
        userIdErr.name = 'userIdErr';
        userIdErr.message = `User ${requestId} not found`;
        throw userIdErr;
    }
}

// for login
const updateTokenInDB = async (email:string, token: string): Promise<any> => {
    Logger.info(`Update user ${(email)} token in database`);
    const query = `update user SET auth_token = '${token}' WHERE email = '${email}'`;
    try{
        const conn = await getPool().getConnection();
        await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
}

// for login
const getUserInfoByEmail = async (email: string) : Promise<any> => {
    Logger.info(`Authenticate user ${(email)} with the database`);
    const query = `select password,id from user where email = '${email}'`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
        const password = result[0].password;
        const id = result[0].id
        return {
           "password":password,
           "id": id
        }
    }
    else{
        return null;
    }
}

const getUserByToken = async (token: string): Promise<any> =>{
    Logger.info( 'Getting related EMAIL/ID by given token from database...' );
    const query = `select email,id from user where auth_token = '${token}';`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
            const id = result[0].id;
            const email = result[0].email
            return [id, email]
    }
    else{
        const userTokenErr: Error = new Error();
        userTokenErr.name = 'userTokenErr';
        userTokenErr.message = `User not found`;
        throw userTokenErr;
    }
}

const getProfilePhotoById = async (userId: number): Promise<any> =>{
    Logger.info( 'Getting profile IMAGE with related user id from database...' );
    const query = `select image_filename from user where id = '${userId}';`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
        return result[0].image_filename;
    }
    else{
        const userIdErr: Error = new Error();
        userIdErr.name = 'userIdErr';
        userIdErr.message = `User ${userId} not found`;
        throw userIdErr;
    }
}

// ——————————————————————————————INSERT Methods——————————————————————————————————
const createAnUser = async (firstName: string, lastName: string, email: string, encryptedPassword: string): Promise<any> => {
    Logger.info(`Adding user ${(email)} to the database`);
    const query = 'insert into user(first_Name, last_Name, email, password) values (?)';
    try {
        const conn = await getPool().getConnection();
        const [result] = await conn.query(query, [[firstName, lastName, email, encryptedPassword]]);
        const id = result.insertId
        conn.release();
        return {
            "userId" : id
        }
    }catch(err){
        throw err;
    }
}

// ——————————————————————————————SELECT Methods——————————————————————————————————
const getAnUser = async (requestedUserId: number, userId: number) : Promise<any> => {
    Logger.info(`Getting user ${requestedUserId} from the database`);
    const query = `select * from user where id = '${requestedUserId}'`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
        const firstName = result[0].first_name;
        const lastName = result[0].last_name;
        const email = result[0].email;
        if (userId === requestedUserId){
            return {
                "firstName": firstName,
                "lastName": lastName,
                "email": email
            }
        }else{
            return {
                "firstName": firstName,
                "lastName": lastName,
            }
        }
    }
    else{
        const userIdErr: Error = new Error();
        userIdErr.name = 'userIdErr';
        userIdErr.message = `User ${requestedUserId} not found`;
        throw userIdErr;
    }
}

const getUserProfileImage = async (userId: number) : Promise<any> => {
    Logger.info(`Getting user ${userId}'s profile photo from the database`);
    const query = `select image_filename from user where id = '${userId}'`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }catch (err){
        throw err;
    }
    if (result.length === 1){
        return result[0].image_filename;
    }
    else{
        const userIdErr: Error = new Error();
        userIdErr.name = 'userIdErr';
        userIdErr.message = `User ${userId} not found`;
        throw userIdErr;
    }
}

// ——————————————————————————————UPDATE Methods——————————————————————————————————
const updateUserDetails = async (userId: number, updateDetails: {}) : Promise<any> => {
    Logger.info(`Updating user ${userId}' information in the database`);
    let queryString = '';
    for (const [key, value] of Object.entries(updateDetails)) {
        if (value !== undefined) queryString += `${key} = '${value}',`
    }
    const finalQueryString = queryString.substring(0, queryString.length - 1);
    const finalQuery = `update user set ${finalQueryString} where id = ${userId}`;
    try{
        const conn = await getPool().getConnection();
        await conn.query(finalQuery);
        conn.release();
        return;
    }catch (err){
        throw err;
    }
}

const logoutUser = async (email: string) : Promise<any> => {
    Logger.info(`Logout user ${(email)}, deleting token from database`);
    const query = `update user SET auth_token = NULL WHERE email = '${email}'`;
    let result;
    try{
        const conn = await getPool().getConnection();
        [ result ] = await conn.query( query );
        conn.release();
    }
    catch (err){
        throw err;
    }
    if (result.affectedRows !== 1) {
        const userEmailErr: Error = new Error();
        userEmailErr.name = 'userEmailErr';
        userEmailErr.message = `User ${email} not found`;
        throw userEmailErr;
    }
}

const updateUserProfileImage = async (userId: number, fileName: string) : Promise<any> => {
    Logger.info(`Updating user ${userId}'s profile photo in the database`);
    const query = `update user SET image_filename = '${fileName}' WHERE id = '${userId}'`;
    try{
        const conn = await getPool().getConnection();
        const [ result ] = await conn.query( query );
        conn.release();
        if (result.affectedRows === 1){
            return;
        }
    }catch (err){
        throw err;
    }
}

// ——————————————————————————————DELETE Methods——————————————————————————————————
const deleteUserProfileImage = async (userId: number) : Promise<any> => {
    Logger.info(`Deleting user ${userId}'s profile photo from the database`);
    const query = `UPDATE user SET image_filename = NULL WHERE id = '${userId}'`;
     try{
        const conn = await getPool().getConnection();
        const [ result ] = await conn.query( query );
        conn.release();
        if (result.affectedRows === 1){
            return;
        }
    }catch (err){
        throw err;
    }
}

export {getPasswordById,getUserByToken,getProfilePhotoById,createAnUser,getAnUser,
    updateUserDetails,getUserInfoByEmail,logoutUser,updateTokenInDB,getUserProfileImage,updateUserProfileImage,
    deleteUserProfileImage}