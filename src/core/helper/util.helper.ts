/* eslint-disable @typescript-eslint/no-unused-vars */

// import * as referralCodes from 'referral-codes';

/**
 * @method convertEnumToJSON
 * @param enumObject enum / object
 * @description This method converts enum to json type object
 * @returns json format of enum
 */
export const convertEnumToJSON = (enumObject: object) => {
  const json: { name: string }[] = [];

  for (const [_, value] of Object.entries(enumObject)) {
    const Document = {
      name: value,
      label: value
        .replace(/([A-Z])/g, '_$1')
        .split(/[_-]/)
        .filter(Boolean)
        .map((word, index) => {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' '),
    };
    // add to array
    json.push(Document);
  }
  return json;
};
export const arrayStartWith = (
  array: string[],
  searchText: string,
): boolean => {
  for (const element of array) {
    if (element.startsWith(searchText)) return true;
  }
  return false;
};

export const snakeCaseToReadableString = (fieldName: string) => {
  // Split the fieldName into words using uppercase letters as delimiters
  const words = fieldName
    .replace(/([A-Z])/g, '_$1')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return words;
};

