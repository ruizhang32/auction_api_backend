import express from "express";
import bodyParser from "body-parser"
import allowCrossOriginRequestsMiddleware from '../app/middleware/cors.middleware';
import Logger from "./logger";
// import sessions from "express-session";
// import cookieParser from "cookie-parser";

export default () => {
    const app = express();
    // MIDDLEWARE
    app.use(allowCrossOriginRequestsMiddleware);
    app.use(bodyParser.json());
    app.use(bodyParser.raw({ type: 'text/plain' }));  // for the /executeSql endpoint
    // 'express.raw' parses incoming request payloads into a Buffer and is based on body-parser
    app.use(express.raw({type: ['image/png','image/gif','image/jpg','image/jpeg'], limit:'5000kb'}));
    // DEBUG (you can remove these)
    app.use((req, res, next) => {
        Logger.http(`##### ${req.method} ${req.path} #####`);
        next();
    });

    app.get('/', (req, res) =>{
        res.send({ 'message': 'Hello World!' })
    });

    // ROUTES
    require('../app/routes/backdoor.routes')(app);
    require('../app/routes/user.server.routes.js')(app);
    require('../app/routes/auction.server.routes.js')(app);

    return app;

};
