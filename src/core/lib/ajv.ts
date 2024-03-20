import config from "#config";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  $data: true
});

addFormats(ajv);

ajv.addFormat("password", function (password) {
  if (!password) return false;

  if (password.length < 8) return false;

  if (password.match(/\d/g) === null) return false;

  if (password.match(/[A-Z]/g) === null) return false;

  if (password.match(/[a-z]/g) === null) return false;

  return true;
});

if (config.countryCode === "en") {
  // Taken from UK government (with spaces removed)
  // https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/488478/Bulk_Data_Transfer_-_additional_validation_valid_from_12_November_2015.pdf
  const postcodeRegex =
    /^([Gg][Ii][Rr]0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z]))))[0-9][A-Za-z]{2})$/;
  ajv.addFormat("postcode", function (postcode) {
    return postcodeRegex.test(postcode.replace(/ /g, "").toLowerCase());
  });
} else if (config.countryCode === "be") {
  ajv.addFormat("postcode", (postcode) => /^[1-9]{1}[0-9]{3}$/.test(postcode));
} else {
  ajv.addFormat("postcode", (postcode) => /^\d{5}$/.test(postcode));
}

const timeRegex = /^\d\d:\d\d$/;
ajv.addFormat("time2", function (time) {
  return timeRegex.test(time);
});

export default ajv;
