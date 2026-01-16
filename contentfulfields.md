## Contentful Fields References

### Lil Snack Day
"Field ID": field-id-en-US 
    -> Use "home_day_[FOLDER NAME]"
"Field Day Number": field-dayNum-en-US 
    -> Use number of days between current date and February 25, 2024
"Field Title": field-title-en-US 
    -> Use Last term from folder name, e.g. if folder is "2025_12_12_TEST", use "TEST"
"Field Win Emoji": field-winEmoji-en-US
    -> Use an emoji representing winning, e.g. "🏆"
"Field Date": field-date-en-US
    -> Use date from folder name in format Mon DD, e.g. if folder is "2025_12_12_TEST", use "Dec 12"
"Date Input": aria-label="Enter date"
    -> Use date from folder name in format DD Mon YYYY, e.g. if folder is "2025_12_12_TEST", use "12 Dec 2025"
"Field Attribute": field-attribute-en-US
    -> Leave blank
"Field Attribute URL": field-attributeUrl-en-US
    -> Leave blank
"Big Banner (True)": entity.bigBanner.en-US.true.HVTnBG
    -> Ignore
"Big Banner (False)": entity.bigBanner.en-US.false.P17P1I
    -> Ignore
"Field Location": field-location-en-US
    -> Ignore
"Field Share Coin Type": field-shareCoinType-en-US
    -> Set to winCoins
"Field Bonus Title": field-bonusTitle-en-US
    -> Leave blank
"Bonus Enabled (True)": entity.bonusEnabled.en-US.true.WLi0O3
    -> Ignore
"Bonus Enabled (False)": entity.bonusEnabled.en-US.false.CtJuhx
    -> Ignore
"Bonus Require Prime (True)": entity.bonusRequirePrime.en-US.true.I4vg7g
    -> Ignore
"Bonus Require Prime (False)": entity.bonusRequirePrime.en-US.false.hqKQur
    -> Ignore
"Field YouTube Text": field-youtubeText-en-US
    -> Leave blank
"Field YouTube URL": field-youtubeUrl-en-US
    -> Leave blank
"Commenting Enabled (True)": entity.isCommentingEnabled.en-US.true.JZjs3o
    -> Ignore
"Commenting Enabled (False)": entity.isCommentingEnabled.en-US.false.jfV6cc
    -> Ignore
"Field Question Of The Day": field-questionOfTheDay-en-US
    -> Leave blank
"Field Question Of The Day Helper Text": field-questionOfTheDayHelperText-en-US
    -> Leave blank
"Field Layout": field-layout-en-US
    -> Ignore
"Field Layout Version": field-layoutVersion-en-US
    -> Ignore
image field
    -> click add media, add new media, then upload image with "banner" AND "day" in the filename
thumbnail field
    -> click add media, add new media, then upload image with "thumbnail" AND "day" in the filename
thumbnailSmall field
    -> click add media, add new media, then upload image with "thumbnail_small" AND "day" in the filename
game1 field
    -> click add media
        if there was is a file with "day" and "prompt"  in the filename, click "ritual prompt"
            -> in the ritual prompt modal, fill out the fields as follows:
                ritualPromptTitle field
                    -> use "Ritual Prompt"
                ritualPromptImage field
                    -> click add media, add new media, then upload image with "day" and "prompt" in the filename
                ritualPromptDescription field
                    -> use "Complete this ritual to earn extra rewards!"
        else if there was is a file with "day" and "prompt[b, 2 or similar suffix]" in the filename, click "prompt"
        else if there was is a file with "day" and "path" in the filename, click "path"
        else if there was is a file with "day" and "swap" in the filename, click "swap"
        else if there was is a file with "day" and "stack" in the filename, click "stack"
        else if there was is a file with "day" and "quote" in the filename, click "quote"
        -> *depending on which game type is made, logic will vary for filling out the rest of the fields--this is to come. for now, just exit the modal for the game1 and return to the main page to go to the next field.*
        -> Log which files were used for this game, and then ignore them for the next games.
game2 field
    -> repeat same logic as game1 field
game3 field
    -> repeat same logic as game2 field
game4 field
    -> repeat same logic as game3 field
bonusImage field
    -> click add media, add new media, then upload image with "bonus" AND "banner" in the filename
bonusGame1 field
    -> click add media
        if there was is a file with "bonus" and "prompt"  in the filename, click "ritual prompt"
        else if there was is a file with "bonus" and "prompt[b, 2 or similar suffix]" in the filename, click "prompt"
        else if there was is a file with "bonus" and "path" in the filename, click "path"
        else if there was is a file with "bonus" and "swap" in the filename, click "swap"
        else if there was is a file with "bonus" and "stack" in the filename, click "stack"
        else if there was is a file with "bonus" and "quote" in the filename, click "quote"
        else if there was is a file with "bonus" and "litebrite" in the filename, click "litebrite"        
        -> *depending on which game type is made, logic will vary for filling out the rest of the fields--this is to come. for now, just exit the modal for the bonusGame1 and return to the main page to go to the next field.*
        -> Log which files were used for this bonus game, and then ignore them for the next bonus game.
bonusGame2 field
    -> click add media
        if there was is a file with "bonus" and "prompt"  in the filename, click "ritual prompt"
        else if there was is a file with "bonus" and "prompt[b, 2 or similar suffix]" in the filename, click "prompt"
        else if there was is a file with "bonus" and "path" in the filename, click "path"
        else if there was is a file with "bonus" and "swap" in the filename, click "swap"
        else if there was is a file with "bonus" and "stack" in the filename, click "stack"
        else if there was is a file with "bonus" and "quote" in the filename, click "quote"
        else if there was is a file with "bonus" and "litebrite" in the filename, click "litebrite"
        -> *depending on which game type is made, logic will vary for filling out the rest of the fields--this is to come. for now, just exit the modal for the bonusGame1 and return to the main page to go to the next field.*
END