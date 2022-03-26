import {Express} from 'express';
import * as auctions from '../controllers/auction.server.controller';
import * as authentication from '../middleware/authentication';

module.exports = (app: Express) => {
    app.route('/api/v1/auctions')
        .get(auctions.getAuctionList)
        .post(authentication.loggedInRequired, auctions.createAuction);

    app.route('/api/v1/auctions/categories/')
        .get(auctions.listCategory);

    app.route('/api/v1/auctions/:id')
        .get(auctions.getAuction)
        .patch(authentication.loggedInRequired, authentication.isSeller, auctions.changeAuction)
        .delete(authentication.loggedInRequired, authentication.isSeller, auctions.removeAuction);

    app.route('/api/v1/auctions/:id/bids')
        .get(auctions.getAuctionBids)
        .post(authentication.loggedInRequired, auctions.addBid)

    app.route('/api/v1/auctions/:id/image')
        .get(auctions.getAuctionImage)
        .put(authentication.loggedInRequired, authentication.isSeller, auctions.setAuctionImage)
}
