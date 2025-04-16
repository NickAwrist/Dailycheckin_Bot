import {Profile} from "../../types";
import logger from "../../utils/logger";
import {incrementTotalCheckins, trackError} from "../../utils/metrics";
import {decrypt} from "../../utils/encryption";

export async function genshinCheckin(profile: Profile): Promise<string> {

    try {
        const url = 'https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481';
        const nickname = profile.nickname;
        const cookies = 'ltoken_v2='+decrypt(profile.pasted_cookie.ltoken_v2)+';'+'ltuid_v2='+decrypt(profile.pasted_cookie.ltuid_v2)+';';

        if (!url) {
            return `Check-in skipped for ${nickname}: Genshin Impact check-in is disabled.`;
        }

        const header = {
            Cookie: cookies,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'x-rpc-app_version': '2.34.1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'x-rpc-client_type': '4',
            'Referer': 'https://act.hoyolab.com/',
            'Origin': 'https://act.hoyolab.com',
        };

        const options: RequestInit = {
            method: 'POST',
            headers: header,
        };

        // Check-in the profile
        try {
            const hoyolabResponse: Response = await fetch(url, options);
            const responseJson = await hoyolabResponse.json();
            const checkInResult: string = responseJson.message;

            if(checkInResult.includes('Not logged in')){
                return `Check-in failed for ${nickname}: **Cookie expired!!!**\nPlease update your cookie with \`/update_profile ${nickname} {new_cookie}\`\n`;
            }

            await incrementTotalCheckins();
            return `Check-in completed for ${nickname}` + `\n${checkInResult}` + '\n';
        } catch (error) {
            logger.error('Error during fetch:', error);
            await trackError('genshinCheckin');
            return `Error during fetch for ${nickname}: `;
        }
    } catch (error) {
        logger.error('Error during genshinCheckin:', error);
        await trackError('genshinCheckin');
        return `Error during genshinCheckin: ${error}`;
    }
}