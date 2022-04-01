import {Express} from 'express';
import * as users from '../controllers/user.server.controller';
import * as authentication from '../middleware/authentication';

module.exports = (app: Express) => {
    app.route('/api/v1/users/register')
        .post(users.createUser);

    app.route('/api/v1/users/login')
        .post(users.login);

    app.route('/api/v1/users/logout')
        .post(authentication.loggedInRequired, users.logout);

    app.route('/api/v1/users/:id')
        .get(authentication.loggedIn, users.getUser)
        .patch(authentication.loggedInRequired, authentication.isUser, users.changeUser)

    app.route('/api/v1/users/:id/image')
        .get(users.getUserImage)
        .put(authentication.loggedInRequired, authentication.isUser, users.setUserImage)
        .delete(authentication.loggedInRequired, authentication.isUser, users.removeUserImage)
}
