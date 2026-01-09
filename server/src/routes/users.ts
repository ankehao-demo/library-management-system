import { Router } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import UserController from '../controllers/user.js';

const userController = new UserController();

const secret = process.env.SECRET || 'secret';

const users = Router();
export default users;

users.get('/login/:username?', async (req, res) => {
    const username = req?.params?.username;
    let user;

    if (username) {
        user = await userController.getUser(username);
    }

    if (!user) {
        user = await userController.createNewUser();
    }

    const jwt = jsonwebtoken.sign({
        sub: user.id,
        name: user.name,
        isAdmin: user.is_admin,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365)
    }, secret, { algorithm: 'HS256' });

    const response = { jwt };

    res.send(response).status(200);
});
