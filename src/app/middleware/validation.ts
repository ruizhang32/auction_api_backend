import emailValidator from 'email-validator';

// ——————————————————————————————Check User——————————————————————————————————
// names can not be null, names have to be string, minLength: 1
const isNameValid = async (name: string) : Promise<boolean> => {
    return name !== null && typeof (name) === 'string' && name.length >= 1;
}

const isEmailValid = async (email: string): Promise<boolean> => {
    return email !== null && typeof (email) === 'string' && emailValidator.validate(email);
}

const isPasswordValid = async (password: string): Promise<boolean> => {
    return password !== null && typeof (password) === 'string' && password.length >= 1;
}

// ——————————————————————————————Check Auction——————————————————————————————————
const isDescriptionValid = async (description: string) : Promise<boolean> => {
    return description !== null && typeof(description) === 'string';
}

const isEndDateValid = async (endDate: string) : Promise<boolean> => {
    const now = Date.parse(new Date().toISOString());
    const endDateTimeStamp = Date.parse(endDate);
    return (!isNaN(endDateTimeStamp) && (endDateTimeStamp > now));
}

const isReserveValid = async (reserve: number) : Promise<boolean> => {
    return typeof(reserve) === 'number' && reserve >= 1;
}

// ——————————————————————————————Check Image——————————————————————————————————
const isImageTypeValid = async (type: string) : Promise<boolean> => {
    return type === 'png' || type === 'jpeg' || type === 'jpg' || type === 'gif';
}

// ——————————————————————————————Check Params——————————————————————————————————
// check if parameter can be parse to number
const isParseIntParamValid = async (param: any) : Promise<boolean> => {
    return !isNaN(parseInt(param,10))
}
export {isNameValid, isEmailValid, isPasswordValid, isDescriptionValid, isEndDateValid,
    isReserveValid, isImageTypeValid, isParseIntParamValid}