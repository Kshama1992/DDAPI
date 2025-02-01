import dayjs from 'dayjs';
import loggerHelper from '@helpers/logger.helper';
import EmailTemplateEntity from '@entity/email-template.entity';
import getRandomInt from '@helpers/get-random-int.helper';
import { AWS_URL, DEFAULT_BRAND_NAME, DOMAIN, SERVER_URL } from '@src/config';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import { sendEmail } from '@helpers/send-mail.helper';
import hbs from 'handlebars';
import BrandEntity from '@entity/brand.entity';
import EmailFilterInterface from 'dd-common-blocks/dist/interface/filter/email-filter.interface';
import BaseService from '@services/base.service';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';

/**
 * Email template service
 */
@Service()
export default class EmailTemplateService extends BaseService {
	constructor() {
		super();
		this.entity = EmailTemplateEntity;
	}

	/**
	 * Get single Email template
	 * @param id
	 */
	async single(id: number): Promise<EmailTemplateEntity | undefined> {
		return MainDataSource.getRepository(EmailTemplateEntity).findOneOrFail({
			where: { id },
			relations: ['emailTemplateType', 'brand', 'emailTemplateType.templateVariables'],
		});
	}

	/**
	 * Get Email templates list
	 */
	async list(params: EmailFilterInterface): Promise<[EmailTemplateEntity[], number]> {
		try {
			const { brandId, emailTemplateTypeId, limit = 10, offset = 0, searchString, status } = params;

			let brandQ = '1=1';

			if (brandId) {
				brandQ = brandId === '9999' ? 'EmailTemplate.brandId IS NULL' : `EmailTemplate.brandId = :brandId`;
			}

			const query = MainDataSource.getRepository(EmailTemplateEntity)
				.createQueryBuilder('EmailTemplate')
				.leftJoinAndSelect('EmailTemplate.emailTemplateType', 'emailTemplateType')
				.leftJoinAndSelect('EmailTemplate.brand', 'brand')
				.where(searchString ? `LOWER(EmailTemplate.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
				.andWhere(brandQ, { brandId })
				.andWhere(status ? `EmailTemplate.status = :status` : '1=1', { status })
				.andWhere(emailTemplateTypeId ? `EmailTemplate.emailTemplateTypeId = :emailTemplateTypeId` : '1=1', { emailTemplateTypeId })
				.take(limit)
				.skip(offset)
				.orderBy('EmailTemplate.id', 'ASC');

			return await query.getManyAndCount();
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}

	async testEmail(email: string, templateId: number) {
		try {
			const repo = MainDataSource.getRepository(EmailTemplateEntity);
			const emailTemplate = await repo.findOneOrFail({
				where: { id: Number(templateId) },
				relations: ['emailTemplateType', 'emailTemplateType.templateVariables', 'brand', 'brand.logo', 'brand.background'],
			});

			const templateVariables: any = {
				brandId: emailTemplate.brandId || undefined,
				brand: {},
				issuedTo: {
					firstName: 'John',
					lastName: 'Doe',
					fullname: 'John Doe',
					email: 'test@mail.com',
					photo: `https://${DOMAIN}/images/header/default-avatar.png`,
					phone: '+1123786868768',
				},
				user: {
					firstName: 'John',
					lastName: 'Doe',
					fullname: 'John Doe',
					email: 'test@mail.com',
					photo: `https://${DOMAIN}/images/header/default-avatar.png`,
					phone: '+1123786868768',
				},
				invoice: {
					tax: 7,
					subTotal: 50,
					status: 'Paid',
					date: dayjs().format('MM/DD/YY'),
					amount: 57,
					invoiceNumber: '000077',
				},
				lines: [...Array(5)].map((item: number, i: number) => ({
					id: i,
					name: `Demo invoice line item #${i}`,
					price: getRandomInt(1, 105),
					tax: getRandomInt(1, 100),
					quantity: getRandomInt(1, 304),
					chargeType: ChargeType.ONE_TIME,
					hours: 1,
					creditHours: 0,
				})),
				venue: {
					name: 'Demo venue',
					logo: `https://${DOMAIN}/images/logo-small.png`,
					image: `https://${DOMAIN}/images/bg-signin.png`,
					address: 'Demo venue address',
					address2: 'address line 2',
					email: 'demo_venue@mail.com',
				},
				space: {
					name: 'Demo space',
					image: `https://${DOMAIN}/images/bg-signin.png`,
					chargeType: ChargeType.ONE_TIME,
				},
				reservation: {
					hoursFrom: dayjs().subtract(4, 'hour').format('D MMMM YYYY HH:mm'),
					hoursTo: dayjs().subtract(2, 'hour').format('D MMMM YYYY HH:mm'),
					bookedAt: dayjs().format('ddd MMM D YYYY'),
					chargeType: ChargeType.ONE_TIME,
				},
				disputeUrl: `https://${DOMAIN}/customer/billing/dispute?id=${0}`,
				emailTo: email,
				link : `${process.env.SMS_BOOKING_URL}`
			};

			if (emailTemplate.brand) {
				// have brand
				templateVariables.brand.name = emailTemplate.brand.name;

				templateVariables.brand.signUrl = emailTemplate.brand.domain
					? `https://${emailTemplate.brand.domain}.${DOMAIN}/sign`
					: `https://${DOMAIN}/sign`;

				templateVariables.brand.locationsUrl = emailTemplate.brand.domain
					? `https://${emailTemplate.brand.domain}.${DOMAIN}/locations`
					: `https://${DOMAIN}/locations`;

				const bgUrl = emailTemplate.brand.background
					? `${AWS_URL}/434x176${emailTemplate.brand.background.url}`
					: `${SERVER_URL}/images/bg-signin.png`;
				templateVariables.brand.backgroundUrl = bgUrl;
				templateVariables.brand.background = bgUrl;

				if (emailTemplate.brand.logo) {
					templateVariables.brand.logoUrl = `${AWS_URL}/434x176${emailTemplate.brand.logo.url}`;
					templateVariables.brand.logo = `${AWS_URL}/434x176${emailTemplate.brand.logo.url}`;
				}
			} else {
				const ddBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
					where: { name: DEFAULT_BRAND_NAME },
					relations: ['logo', 'background'],
				});
				templateVariables.brand.name = ddBrand.name;

				templateVariables.brand.signUrl = ddBrand.domain ? `https://${ddBrand.domain}.${DOMAIN}/sign` : `https://${DOMAIN}/sign`;

				templateVariables.brand.locationsUrl = ddBrand.domain
					? `https://${ddBrand.domain}.${DOMAIN}/locations`
					: `https://${DOMAIN}/locations`;

				const bgUrl = ddBrand.background ? `${AWS_URL}/434x176${ddBrand.background.url}` : `${SERVER_URL}/images/bg-signin.png`;
				templateVariables.brand.backgroundUrl = bgUrl;
				templateVariables.brand.background = bgUrl;

				if (ddBrand.logo) {
					templateVariables.brand.logoUrl = `${AWS_URL}/434x176${ddBrand.logo.url}`;
					templateVariables.brand.logo = `${AWS_URL}/434x176${ddBrand.logo.url}`;
				}
			}

			const { fromName, fromEmail, subject, html: templateHtml } = emailTemplate;

			const posibleVars = { ...templateVariables, fromName, fromEmail, subject };

			const htmlTemplate = hbs.compile(templateHtml);
			const subjTemplate = hbs.compile(subject);

			return sendEmail({
				to: templateVariables.emailTo,
				from: { name: fromName, address: fromEmail },
				subject: subjTemplate(posibleVars),
				html: htmlTemplate(posibleVars),
			},false);
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}
}
