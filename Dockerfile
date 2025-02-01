FROM public.ecr.aws/docker/library/node:20-alpine AS builder

RUN apk add --no-cache bash git openssh

ARG appDir=/home/node/app
ARG PRIVATE_KEY_PASSPHRASE
ARG REFRESH_TOKEN_PASSPHRASE
ENV PRIVATE_KEY_PASSPHRASE=${PRIVATE_KEY_PASSPHRASE}
ENV REFRESH_TOKEN_PASSPHRASE=${REFRESH_TOKEN_PASSPHRASE}

WORKDIR $appDir

COPY generate-keys.js package.json yarn.lock ./

RUN yarn cache clean && \
    yarn install --frozen-lockfile --ignore-scripts

COPY .env ./ 
COPY tsconfig.json ./ 
COPY src/ ./src/

RUN mkdir -p $appDir/keys && \
    touch $appDir/keys/private.pem $appDir/keys/public.pem $appDir/keys/private-refresh.pem $appDir/keys/public-refresh.pem && \
    node ./generate-keys.js

FROM public.ecr.aws/docker/library/node:20-alpine AS runner

RUN addgroup -S app && adduser -S app -G app

USER app

WORKDIR /app

COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/tsconfig.json ./tsconfig.json
COPY --from=builder /home/node/app/.env ./.env
COPY --from=builder /home/node/app/package.json ./package.json
COPY --from=builder /home/node/app/src/ ./src/
COPY --from=builder /home/node/app/keys/ ./keys/

EXPOSE 3000

RUN if [ "$NODE_ENV" = "development" ]; then \
    EXPOSE 9229; \
    fi

CMD [ "yarn", "start" ]