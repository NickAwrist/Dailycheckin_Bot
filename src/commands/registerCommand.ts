import {CommandInteraction, DiscordAPIError, DMChannel} from 'discord.js';
import { Profile, upsertUser, getProfilesByDiscordID, UID, getUserByDiscordID, User } from '../bot';
import { getUserGenshinInfo } from '../genshin/getUserInfo_genshin';
import { getUserStarrailInfo } from '../hk_starrail/getUserInfo_hkstr';
import { getUserZenlessInfo } from '../zenless_zone_zero/getUserInfo_zenless';

async function collectNickname(dmChannel: DMChannel): Promise<string | null> {
    await dmChannel.send('---------------\n**Please enter the nickname of the profile you would like to create/update.**\n');
    return new Promise((resolve) => {
        const nicknameCollector = dmChannel.createMessageCollector({ max: 1, time: 300000 });

        nicknameCollector.on('collect', (message) => {
            const nickname = message.content.trim();
            if (nickname) {
                resolve(nickname);
            } else {
                dmChannel.send('Invalid input. Please provide a valid nickname.');
                resolve(null);
            }
        });

        nicknameCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                dmChannel.send('Nickname collection timed out. Please try again.');
                resolve(null);
            }
        });
    });
}

async function collectCookie(dmChannel: DMChannel): Promise<string | null> {
    await dmChannel.send('---------------\n**Please paste your Hoyolab Cookie**\n');
    return new Promise((resolve) => {
        const cookieCollector = dmChannel.createMessageCollector({ max: 1, time: 300000 });

        cookieCollector.on('collect', (message) => {
            let cookie = message.content.trim();
            if (cookie.includes('Cookie:')) {
                cookie = cookie.replace('Cookie:', '').trim();
            }

            if (cookie) {
                resolve(cookie);
            } else {
                dmChannel.send('Invalid input. Please provide a valid cookie.');
                resolve(null);
            }
        });

        cookieCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                dmChannel.send('Cookie collection timed out. Please try again.');
                resolve(null);
            }
        });
    });
}

export async function register(interaction: CommandInteraction) {
    try {
        // Create dmChannel and send instructions
        let dmChannel: DMChannel;
        try {
            dmChannel = await interaction.user.createDM();
            await dmChannel.send('Please follow these instructions carefully.\nhttps://drive.google.com/file/d/1-xQcXzajgvd2dq3r9ocVW5fUcf6DybG0/view?usp=sharing\n\n');

            await interaction.reply({ content: "Please check your DMs for further instructions.", ephemeral: true });
        } catch (err) {
            if (err instanceof DiscordAPIError) {
                if (err.code === 50007) {
                    console.error('Cannot send messages to this user:', err);
                    await interaction.reply({ content: 'I was unable to send you a direct message. Please ensure your DMs are open and try again.', ephemeral: true });
                } else {
                    console.error('Error creating DM Channel:', err);
                    await interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
                }
            } else if (err instanceof Error) {
                console.error('General error:', err);
                await interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
            } else {
                console.error('Unknown error type:', err);
                await interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
            }
            return;
        }

        // Start the data collection

        // Check if the user already has an account
        const existingUser: User | undefined = getUserByDiscordID(interaction.user.id);
        const profiles: Profile[] | undefined = getProfilesByDiscordID(interaction.user.id);

        if (existingUser) {
            dmChannel.send('Welcome back! Here are your current profiles:');
            if (!profiles) return;

            // Display each profile the user has
            profiles.forEach(profile => {

                let response: string = "";

                response += `-------**${profile.nickname}**-------\n`;

                if (profile.genshin.length > 0) {
                    response += '**Genshin Impact**\n';
                    profile.genshin.forEach(uid => {
                        response += `Server: ${uid.region_name}\nNickname: ${uid.nickname}\nlvl: ${uid.level}\n`;
                    });
                }
                if (profile.hk_str.length > 0) {
                    response += '**Honkai Starrail**\n';
                    profile.hk_str.forEach(uid => {
                        response += `Server: ${uid.region_name}\nNickname: ${uid.nickname}\nlvl: ${uid.level}\n`;
                    });
                }
                if (profile.zzz.length > 0) {
                    response += '**Zenless Zone Zero**\n';
                    profile.zzz.forEach(uid => {
                        response += `Server: ${uid.region_name}\nNickname: ${uid.nickname}\nlvl: ${uid.level}\n`;
                    });
                }
                dmChannel.send(response);
            });
        }

        // Collect nickname
        const nickname: string | null = await collectNickname(dmChannel);
        if (!nickname) return;

        // Collect cookie
        const cookie: string | null = await collectCookie(dmChannel);
        if (!cookie) return;

        // Translate the cookies into JSON
        const cookierPairs = cookie?.split(';').map(pair => pair.trim().split('='));
        const cookieJSON: Record<string, string> = {};
        cookierPairs?.forEach(([key, value]) => {
            cookieJSON[key] = value;
        });

        // Fetch their Genshin Impact data
        console.log('--Fetching Genshin Impact Data');
        const genshinUIDs: UID[] = await getUserGenshinInfo(cookie, dmChannel);

        // Fetch their Honkai Starrail data
        console.log('--Fetching Honkai Starrail Data');
        const hkstrUIDs: UID[] = await getUserStarrailInfo(cookie, dmChannel);

        // Fetch their Zenless Zone Zero data
        console.log('--Fetching Zenless Zone Zero Data');
        const zenlessUIDs: UID[] = await getUserZenlessInfo(cookie, dmChannel);

        // Create the new User
        const newProfile: Profile = {
            'nickname': nickname,
            'genshin': genshinUIDs,
            'hk_str': hkstrUIDs,
            'zzz': zenlessUIDs,
            'hk_imp': [],
            'pasted_cookie': cookieJSON,
            'raw_cookie': cookie
        };

        let completeResponse: string = "";
        if (newProfile.genshin.length == 0 && newProfile.hk_str.length == 0 && newProfile.zzz.length == 0) {
            completeResponse += 'No accounts were found with the provided cookies. Please try again.';
            completeResponse += 'If this issue persists. Try logging out of Hoyolab and logging back in.';
        } else {
            // If the user has an account, update it. Otherwise, create a new one.
            if (existingUser) {
                // If the profile nickname exists, update it. Otherwise, add it.
                const existingProfileIndex: number = existingUser.profiles.findIndex(profile => profile.nickname.toLowerCase() === nickname.toLowerCase());
                if (existingProfileIndex > -1) {
                    existingUser.profiles[existingProfileIndex] = newProfile;
                } else {
                    existingUser.profiles.push(newProfile);
                }

                upsertUser(existingUser);
            } else {
                const newUser: User = {
                    'username': interaction.user.username,
                    'discord_id': interaction.user.id,
                    'profiles': [newProfile]
                };
                upsertUser(newUser);
            }

            completeResponse += "Registration complete! Your profile has been saved!\n";
            completeResponse += "Your profile is enrolled to check-in everyday at `12:07PM EST`.\n";
            completeResponse += "You can also manually check-in using the `/checkin` command.\n";


        }
        dmChannel.send(completeResponse);

    } catch (error) {
        console.error('Error during registration process');
        //await interaction.followUp({content: 'An error occurred during the registration process. Please make sure your DMs are open.', ephemeral: true});
    }
}