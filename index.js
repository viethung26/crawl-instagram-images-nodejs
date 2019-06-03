const fs = require('fs')
const puppeteer = require('puppeteer')
const download = require('image-downloader')

const INPUT_PATH = __dirname.concat('/', "input.txt") 
const INSTAGRAM_URL = 'https://www.instagram.com/'
const MAX_LIMIT = 5

const loadData = async() => {
    if(fs.existsSync(INPUT_PATH)) {
        const data = await new Promise ((resolve, reject) => {
            fs.readFile(INPUT_PATH, (err, fileData) => {
                if(err) console.log('reading error',err)
                if(fileData) resolve(fileData)
                else reject({error: 'file null'})
            })
        })
        const usersData = data.toString().split('\n').map(user => user.trim())
        return usersData.filter(user => user.length > 0 && !/\s/.test(user))
    } else console.log('Reading error: File not found')
    return []
}

const scrollToEndPage = async (page) => {
    await page.evaluate(async() => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    })
}

const scrollUpOnce = async (page) => {
    return await page.evaluate(async() => {
        return await new Promise((resolve, reject) => {
            let distance = 100;
            let count = 0
            let timer = setInterval(() => {
                if(count>5) {
                    clearInterval(timer)
                    resolve(true) // not top of page
                }
                else count ++
                window.scrollBy(0, -distance);

                if(window.pageYOffset <= 0){
                    clearInterval(timer);
                    resolve(false) // top of page
                }
            }, 100);
        });
    })
}

const getSrcLinksAtCurrentOffset = async(page) => {
    return await page.evaluate(() => {
        let imageElements = document.querySelectorAll('img')
        imageElements = [...imageElements]
        // imageElements = imageElements.filter(img => img.getAttribute('sizes') === '293px')
        let links = imageElements.map(img => img.getAttribute('src'))
        return links
    })
}

const getFullLinks = async(page) => {
    await scrollToEndPage(page)
    let stop = false
    let fullLinks = []
    while(!stop) {
        stop = ! await scrollUpOnce(page);
        const links = await getSrcLinksAtCurrentOffset(page)
        fullLinks.push(...links)
    }
    fullLinks = new Set(fullLinks)
    if(fullLinks.has(null)) fullLinks.delete(null)
    return Array.from(fullLinks)
}

const crawl = async (user) => {
    const DIR_PATH = __dirname.concat('/Output/', user.replace(/\./g, ""))
    if (fs.existsSync(DIR_PATH)) return
    const browser = await puppeteer.launch({headless: true})
    const page = await browser.newPage()
    await page.goto(INSTAGRAM_URL + user)
    const fullLinks = await getFullLinks(page)
    if(fullLinks.length > 0) {
        await fs.mkdir(DIR_PATH,(err) => {
            if (err) console.log("Making directory error: ", err)
        })
        const dataOutput = "Quantity: ".concat(fullLinks.length, "\n", JSON.stringify(fullLinks).replace(/,/g, '\n'))
        await Promise.all(fullLinks.map(link => {
            download.image({
                url: link,
                dest: DIR_PATH
            }).catch(e => console.log("error", link))
        }))
    } 
    await browser.close()
}

const main = async() => {
    let data = await loadData()
    console.log(data)
    if(data.length > 0) {
        while(data.length > 0) {
            const subData = data.slice(0, MAX_LIMIT)
            data = data.slice(MAX_LIMIT)
            await Promise.all(subData.map(user => crawl(user)))
        }
        console.log("DONE-ENJOY")
    }
    else console.log('Input file empty or wrong input format, please enter each user on one line into input.txt file')
}
main()