// server/oauth-handler.js
const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
);

// スコープ定義
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// 認証URLを生成
function getAuthUrl() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    return authUrl;
}

// 認証コードからトークンを取得
async function getTokenFromCode(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

module.exports = {
    getAuthUrl,
    getTokenFromCode,
    oauth2Client
};
