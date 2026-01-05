import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { UTApi } from "uploadthing/server";

const handler = createRouteHandler({
  router: ourFileRouter,
  config: {
    callbackUrl: "http://localhost:3000/api/uploadthing",
    token: "eyJhcGlLZXkiOiJza19saXZlXzU5M2RhMjhkMDMyZTQ1NGI2ZGJhZjI0YjA2NjlkOWZhODdmNWE4NDM1OTFiZDkwZWJiMGZjMDY0OWVlYzI0NjciLCJhcHBJZCI6ImdidjBodDk4eHkiLCJyZWdpb25zIjpbInNlYTEiXX0=", // 👈 Aquí pega tu token manual
  },
});
export const { GET, POST } = handler;
