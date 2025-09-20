import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsPassword', async: false })
export class CustomValidateIsPassword implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    const IsPassword =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[_@./!@#$%^*(),~`'":;\\\?}\<\>\]\{[&+-]).{6,}$/;

    return IsPassword.test(text);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} minimum of eight characters, at least one uppercase letter, one lowercase letter, and one number`;
  }
}
