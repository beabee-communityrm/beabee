import { generateApiKey } from "./auth";

describe("Test length of generated API Key components", () => {
  const idLength = 8;
  const secretLength = 24;
  const { id, secret, secretHash, token } = generateApiKey(
    idLength,
    secretLength
  );

  it("token contains two parts of the correct length", () => {
    expect(token.split("_").length).toBe(2);
    expect(token.split("_")[0]).toBe(id);
    expect(id.length).toBe(idLength);
    expect(token.split("_")[1]).toBe(secret);
    expect(secret.length).toBe(secretLength);
  });

  it("hash has length of 64 characters = 256 bit", () => {
    expect(secretHash.length).toBe(64);
  });
});
