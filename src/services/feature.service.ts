import { Service } from 'typedi';
import { Features } from '@src/utils/features';
import Feature from '@src/interface/feature.interface';

@Service()
export default class FeatureService {
	async list(): Promise<Feature[]> {
		const features = new Features();
		return features.getAllFlags();
	}
}
