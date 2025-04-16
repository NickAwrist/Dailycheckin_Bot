import { getAllUsers} from "../database/userRepository";

import { genshinCheckin } from '../games/genshin/checkin_genshin';
import { hkstrCheckin } from '../games/hk_starrail/checkin_hkstr';
import { zzzCheckin } from '../games/zenless_zone_zero/checkin_zenless';
import {User} from "../types";
import logger from "../utils/logger";

export async function checkinAllUsers() {

    // Gather all user's information from database
    const users: User[] = await getAllUsers();


    for(const user of users){

        try {

        
            logger.info(`--Checking in user: ${user.username}--`);

            for(const profile of user.profiles){
                logger.info(`--Checking in profile: ${profile.nickname}--`);

                if(profile.genshin.length > 0){
                    logger.info('Checking in Genshin Impact');
                    const genshinResult: string = await genshinCheckin(profile);
                    logger.info(genshinResult);
                }

                if(profile.hk_str.length > 0){
                    logger.info('Checking in Honkai Starrail');
                    const hkstrResult: string = await hkstrCheckin(profile);
                    logger.info(hkstrResult);
                }

                if(profile.zzz.length > 0){
                    logger.info('Checking in Zenless Zone Zero');
                    const zzzResult: string = await zzzCheckin(profile);
                    logger.info(zzzResult);
                }

                // Delay between check-ins
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            logger.error(`Error checking in user: ${user.username}`, error);
        }
    }
}

