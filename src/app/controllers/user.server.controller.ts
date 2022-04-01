import Logger from "../../config/logger";
import {Request, Response} from "express";
import * as users from '../models/user.server.model';
import * as validation from '../middleware/validation';
import bcrypt from 'bcryptjs';
import uuidAPIKey from 'uuid-apikey';
import * as fs from "fs";

// ——————————————————————————————CHECK——————————————————————————————————
const doesEmailExist = async(email: string, res: Response): Promise<any>=>{
    try{
        const result = await users.getUserInfoByEmail(email); // check email has not been registered yet
        // if result is null, means can not find any user related with this email, so has not been registered
        return result !== null;
    }
    catch(err) {
        res.status(500).send(`ERROR getting user by email: ${email}: ${err}`);
    }
}

// ——————————————————————————————POST Methods——————————————————————————————————
// create a user with request body that follows the `User` schema definition
const createUser = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Create a new user`);
    // check no request body value is missing
    if(!req.body.hasOwnProperty('firstName') || !req.body.hasOwnProperty('lastName') ||
        !req.body.hasOwnProperty('email') || !req.body.hasOwnProperty('password') ){
        res.status(400).send("Names, email and password are required");
        return;
    }
    const firstName  = req.body.firstName;
    const lastName  = req.body.lastName;
    const email = req.body.email;
    const password = req.body.password;
    // check request body value schema
    if(!await validation.isNameValid(firstName)) {
        res.status(400).send("First name has to be 'string' , minimum length of names is 1");
        return;
    }if(!await validation.isNameValid(lastName)) {
        res.status(400).send("Last name has to be 'string' , minimum length of names is 1");
        return;
    }if(!await validation.isEmailValid(email)){
        res.status(400).send("Not valid email address");
        return;
    }if(!await validation.isPasswordValid(password)) {
        res.status(400).send("Password has to be 'string' , minimum length of password is 1");
        return;
    }
    else {
        if(!await doesEmailExist(email, res)){
           try {
            const encryptedPassword = await bcrypt.hash(password, 10);
            const result = await users.createAnUser(firstName, lastName, email, encryptedPassword);
            res.status( 201 ).json( result );
            return;
            } catch( err ) {
                res.status( 500 ).send( `ERROR registering ${email}: ${err}` );
            }
        }else{
            res.status(400).send("This email has been registered");
            return;
        }
    }
}; // 201,400,500

// Log in as an existing user. Authentication by given query parameters `email` and `password`
const login = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Logging in user...`);
     if(!req.body.hasOwnProperty('email') || !req.body.hasOwnProperty('password') ){
        res.status(400).send("email and password are required for login");
        return;
    }
    const email = req.body.email;
    const password = req.body.password;
    if(!await validation.isEmailValid(email)){
        res.status(400).send("Not valid email address");
        return;
    }
    if(!await validation.isPasswordValid(password)) {
        res.status(400).send("Password has to be 'string' , minimum length of password is 1");
        return;
    }
    else if(await doesEmailExist(email, res)){
        /*get user id and password by email from database*/
            const result = await users.getUserInfoByEmail(email);
            if (result === null){
                res.status(404).send(`User not found`);
                return;
            }
            else if (result === Error){
                res.status(500).send(`ERROR login user ${email}: ${Error}`);
                return;
            }
            else{ // if get user id from email
                let pswInDB: string;
                let userId: number;
                let match: boolean;
                pswInDB = result.password;
                userId = result.id;
                // compare password passed by request body with password in database
                match = await bcrypt.compare(password, pswInDB);
                // if matches, generate a token and update token attribute in database
                if(match) {
                    const uuidAPIKeypair = uuidAPIKey.create();
                    const apikey = uuidAPIKeypair.apiKey;
                    try{
                        await users.updateTokenInDB(email,apikey);
                        return res.status(200).json({
                            'userId':userId,
                            'token':apikey
                        });
                    }catch(err){
                        res.status(500).send(`ERROR login user ${email}: ${err}`);
                        return;
                    }
                }
                else{
                    res.status(400).send({msg:'Wrong password. Please try again'})
                    return;
                }
        }
    }
};// 200,400,500

// Log out an user by delete provided auth token
const logout = async (req: Request, res: Response) : Promise<any> => {
    Logger.http('Logging out user...');
    const email = res.locals.email;
    try{
        await users.logoutUser(email);
        res.status( 200 ).send();
    }catch(err){
        res.status( 500 ).send( `ERROR logout user ${email}: ${ Error }`);
    }
};// 200,401,500

// ——————————————————————————————GET Methods——————————————————————————————————
// return an user's detail given user id. Authentication by given request header `token`
const getUser = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`GET user id: ${req.params.id}'s information.`);
    const requestId = parseInt(req.params.id,10);
    const userId = res.locals.id;
    try{
        const result = await users.getAnUser(requestId, userId);
        if(result === null){
            res.status( 404 ).send('User not found');
        }else {
            res.status( 200 ).json( result );
        }
    }catch(err){
        res.status( 500 ).send( `ERROR reading user ${requestId}: ${ err }`);
    }
};// 200,404,500

// return an user's profile image given user id
const getUserImage = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Get user id: ${req.params.id}'s profile photo`);
    const requestId = parseInt(req.params.id,10);
    // get profile image name by id
    let fileName :string = null;
    try{
        const result = await users.getUserProfileImage(requestId);
        if(result === null){
            res.status( 404 ).send('No profile image yet');
        }else{
            fileName = result;
            const filePath = 'storage/images/' + fileName;
            const fileType = fileName.split('.')[1];
            if(await validation.isImageTypeValid(fileType)){
                try{
                    return res.status(200).attachment(filePath).send();
                }catch(err){
                    res.status(500).send(`fs reading ERROR: ${ err }`);
                }
            }
        }
    }catch(err){
        res.status( 500 ).send( `ERROR getting user ${req.params.id}'s profile photo name: ${ err }`);
    }
};// 200,404,500

// ——————————————————————————————PATCH Methods——————————————————————————————————
// update an user's detail given user id with request body that follows the `User` schema definition
// Authentication by given request header `token`
const changeUser = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Change user id: ${req.params.id}'s profile`);
    const updateDetails: {[id: string] : string; } = {};
    const requestId = parseInt(req.params.id,10);
    // check request body is not empty
    if (req.body.length === 0) {
        res.status(400).send(`Updating content can not be empty.`);
        return;
    }
    //  check request body schema and availability
    else {
        if (req.body.hasOwnProperty('firstName')) {
            const firstName = req.body.firstName;
            if (!await validation.isNameValid(firstName)) {
                res.status(400).send("First name has to be 'string' , minimum length of names is 1");
                return;
            } else {
                updateDetails.first_name = firstName;
            }
        }
        if (req.body.hasOwnProperty('lastName')) {
            const lastName = req.body.lastName;
            if (!await validation.isNameValid(lastName)) {
                res.status(400).send("Last name has to be 'string' , minimum length of names is 1");
                return;
            } else {
                updateDetails.last_name = lastName;
            }
        }
        if (req.body.hasOwnProperty('email')) {
            const email = req.body.email;
            if (!await validation.isEmailValid(email)) {
                res.status(400).send("Not valid email address");
                return;
            }
            else {
                updateDetails.email = email;
            }
        }
        if (req.body.hasOwnProperty('password')) {
            const password = req.body.password;
            const currentPassword = req.body.currentPassword;
            let passwordInDB: string = '';
            try{
                const result1 = await users.getPasswordById(requestId);
                if (result1 === null) {
                    res.status(400).send('User not found');
                }
                else {
                    passwordInDB = result1;
                    const match = await bcrypt.compare(currentPassword, passwordInDB);
                    if (!await validation.isPasswordValid(password)) {
                        res.status(400).send("Password has to be 'string' , minimum length of password is 1");
                        return;
                    }
                    if (!match) {
                        res.status(401).send("Current password is invalid");
                        return;
                    } else {
                        updateDetails.password = await bcrypt.hash(password, 10);
                    }
                }
            }catch(err){
                res.status(500).send(`ERROR get user by id:'${requestId}': ${err}`);
                    return;
            }
        }
    }
    try{
        await users.updateUserDetails(requestId, updateDetails);
        res.status( 200 ).send();
    }catch(err){
        res.status( 500 ).send( `ERROR updating user ${requestId}'s details: ${ err }`);
    }
};// 200,400,401,403,500

// ——————————————————————————————PUT Methods——————————————————————————————————
// update user's profile image. Authentication by given request header `token`
const setUserImage = async (req: Request, res: Response) : Promise<void> => {
    Logger.http(`Set user ${req.params.id}'s profile image`);
    const requestId = parseInt(req.params.id,10)
    const imageType = req.headers['content-type'].substring(6,).toLowerCase();
    // use express.raw({type}) to parse request body
    const imageBinary = req.body;
    let fileName : string = '';
    // check if image is the right type
    if(!await validation.isImageTypeValid(imageType)){
        res.status(400).send(`Image type not valid`);
        return;
    }
    // check if request body is empty
    if (!imageBinary) {
        res.status(400).send(`Request image data content can not be empty.`);
        return;
    }// ----check end---
    try{
        fileName = 'user_' + requestId.toString() + '.' + imageType;
        const filePath = 'storage/images/' + fileName;
        await fs.writeFileSync(filePath, imageBinary, 'binary');
    }catch(err){
        res.status(500).send(`fs writing ERROR: ${ err }`);
        return;
    }
    // check profile photo name by id
    let imageFileExist : boolean = false;
    try{
        const result = await users.getProfilePhotoById(requestId);
        imageFileExist = result !== null;
    }catch(err){
        res.status( 500 ).send( `ERROR get user's photo by id:${requestId} : ${ err }`);
    }
    try{
        await users.updateUserProfileImage(requestId,fileName);
        // If the user already has a profile photo,
        // the current profile photo will be replaced with it, and a 200 OK response will be sent
        if(imageFileExist){
           res.status( 200 ).send( 'User profile image updated' );
        }else{ // If not, a 201 Created response will be sent
            res.status( 201 ).send( 'User profile image created' );
        }
    }catch(err){
        res.status( 500 ).send( `ERROR updating user ${requestId}: ${ err }`);
    }
};// 200,201,400,401,403,404,500

// ——————————————————————————————DELETE Methods——————————————————————————————————
// delete user's profile image. Authentication by given request header `token`
const removeUserImage = async (req: Request, res: Response) : Promise<any> => {
    Logger.http(`Delete user ${req.params.id}'s profile photo`);
    const requestId = parseInt(req.params.id,10);
    // get profile image name by id
    let fileName :string = null;
    try{
        const result = await users.getUserProfileImage(requestId);
        if(result === null){
            res.status(404).send("Profile photo doesn't exist")
        }else{
            fileName = result[0].image_filename;
        }
    }catch (err){
        res.status( 500 ).send( `ERROR getting user ${req.params.id}'s profile photo name: ${ err }`);
    }
    const filePath = 'storage/images/' + fileName;
    await fs.unlinkSync(filePath);
    try {
        await users.deleteUserProfileImage(requestId);
        res.status( 200 ).send( 'User profile photo has been deleted' );
    } catch( err ) {
        res.status( 500 ).send( `ERROR deleting user ${requestId}'s User profile photo: ${ err }`);
    }
};// 200,401,403,404,500

export {createUser,getUser,changeUser,login,logout,getUserImage,setUserImage,removeUserImage}