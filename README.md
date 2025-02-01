![repo-banner](./logo.png)

## Quick Start

-   Generate SSL keys (skip this step on local machine)

```bash
sudo chmod +x ./sh/init-letsencrypt.sh && sudo ./sh/init-letsencrypt.sh
```

-   Start App:
-   For production


```bash
sudo chmod +x ./deploy-prod.sh
sudo ./deploy-prod.sh
```

-   For development

```bash
docker-compose -p dd-api up -d -f docker-compose.dev.yml
```

Then open http://localhost/ to see your API.

### Environment Variables

-   `process.env.NODE_ENV`: `'development'` or `'production'`
-   `process.env.S3_BUCKET_NAME`: AWS S3 bucket name.
-   `process.env.S3_ACCESS_KEY_ID`: AWS access key.
-   `process.env.S3_SECRET_ACCESS_KEY`: AWS secret key.
-   `process.env.PRIVATE_KEY_PASSPHRASE`: JWT token secret passphrase.
-   `process.env.TOKEN_EXPIRE`: JWT token expiration time.
-   `process.env.MAILGUN_DOMAIN`: Mailgun domain.
-   `process.env.MAILGUN_API_KEY`: Mailgun API key.
-   `process.env.STRIPE_API_VERSION`: STRIPE API version.
-   `process.env.STRIPE_SECRET_KEY`: STRIPE secret key.
-   `process.env.STRIPE_PUBLISH_KEY`: STRIPE publish key.
-   `process.env.TWILIO_FROM`: TWILIO from phone number.
-   `process.env.TWILIO_SECRET`: TWILIO secret.
-   `process.env.TWILIO_SID`: TWILIO application SID.
-   `process.env.TWILIO_DEVELOPERS_PHONES`: List of developers phone to avoid big amount of sent sms and sms cost.

All variable will be accessible after executing `dotenv.config()`.

```javascript
import dotenv from 'dotenv';
dotenv.config();

const someFunc = () => {
	// you can use env variables
	const mailApiKey = process.env.MAILGUN_API_KEY;
};
```

### Crontab set up (deprecated. use node-cron instead)

On host machines crontab need to add

```
0 * * * * cd /home/ubuntu/app && /usr/local/bin/docker-compose run --rm api yarn run cron:hourly >> /home/ubuntu/cront-hourly.log 2>&1

0 0 * * * cd /home/ubuntu/app && /usr/local/bin/docker-compose run --rm api yarn run cron:daily >> /home/ubuntu/cront-daily.log 2>&1

0 0 1 * * cd /home/ubuntu/app && /usr/local/bin/docker-compose run --rm api yarn run cron:monthly >> /home/ubuntu/cront-monthlyx.log 2>&1

```


### Install gitlab runner
* Download  ```curl -LJO "https://gitlab-runner-downloads.s3.amazonaws.com/latest/deb/gitlab-runner_amd64.deb"```
* Install ```dpkg -i gitlab-runner_amd64.deb```
* Register runner ```sudo gitlab-runner register``` . Gitlab url and token creds u will see in Gitlab  CI setting in part “Runners”. Tags are in .gitlab-ci.yml file in appropriate deployment part
* To run shell scripts on runner machine you need to add gitlab-runner user to sudoers. ```sudo nano /etc/sudoers``` . Add to the end of file ```gitlab-runner ALL=(ALL) NOPASSWD: ALL```



 /usr/local/bin/psql --file=/Users/alex/Downloads/DEV-2021_12_22_23
_31_00-dump.sql --username=testing_user --host=localhost --port=5432 --dbname=testing_db1



