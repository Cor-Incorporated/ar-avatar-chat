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
    try {
        console.log('[OAuth] Exchanging code for token...');
        console.log('[OAuth] Code:', code.substring(0, 20) + '...');
        console.log('[OAuth] Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'NOT SET');
        console.log('[OAuth] Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'NOT SET');
        console.log('[OAuth] Redirect URI:', 'http://localhost:3000/oauth2callback');

        const { tokens } = await oauth2Client.getToken(code);
        console.log('[OAuth] Token exchange successful!');
        return tokens;
    } catch (error) {
        console.error('[OAuth ERROR] Token exchange failed:', error.message);
        console.error('[OAuth ERROR] Full error:', error);
        throw error;
    }
}

module.exports = {
    getAuthUrl,
    getTokenFromCode,
    oauth2Client
};
