import BrandEntity from '@entity/brand.entity';
import { Request, Response } from 'express';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';

@Service()
export default class MainService {
	index(req: Request, res: Response): Response {
		return res.status(200).send('Hello from Drop-desk!');
	}

	async heartBeat(req: Request, res: Response): Promise<Response> {
		const brandRepo = MainDataSource.getRepository(BrandEntity);
		try {
			await brandRepo.findOneOrFail({ select: ['name'] });
			return res.status(200).send();
		} catch (e) {
			return res.status(500).send();
		}
	}
}
