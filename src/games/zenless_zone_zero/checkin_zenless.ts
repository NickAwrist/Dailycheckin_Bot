import {Profile} from "../../types";
import logger from "../../utils/logger";
import {incrementTotalCheckins, trackError} from "../../utils/metrics";
import {decrypt} from "../../utils/encryption";

export async function zzzCheckin(profile: Profile): Promise<string> {
    try {
        const url = 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign?lang=en-us&act_id=e202406031448091';
        const username = profile.nickname;
        const cookies = 'ltoken_v2='+decrypt(profile.pasted_cookie.ltoken_v2)+';'+'ltuid_v2='+decrypt(profile.pasted_cookie.ltuid_v2)+';';

        if (!url) {
            return `Check-in skipped for ${username}: Zenless Zone Zero check-in is disabled.`;

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

            await incrementTotalCheckins();
            return `Check-in completed for ${username}` + `\n${checkInResult}` + '\n';
        } catch (error) {
            logger.error('Error during fetch:', error);
            await trackError('zzzCheckin');
            return `Error during fetch for ${username}: `;
        }
    } catch (error) {
        logger.error('Error during zzzCheckin:', error);
        await trackError('zzzCheckin');
        return `Error during zzzCheckin: ${error}`;
    }
}