export default interface BaseInterface {
    id?: number;
    readonly createdAt: Date;
    readonly updatedAt: Date | undefined;
}