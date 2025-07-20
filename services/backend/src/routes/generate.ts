import { DataSpecificationWithMetadata, DataSpecificationWithStores } from "@dataspecer/backend-utils/interfaces";
import { StoreDescriptor } from "@dataspecer/backend-utils/store-descriptor";
import { CoreResourceReader } from "@dataspecer/core/core/core-reader";
import { ReadOnlyFederatedStore } from "@dataspecer/core/core/index";
import { DataSpecification } from "@dataspecer/core/data-specification/model/data-specification";
import { InputStream } from "@dataspecer/core/io/stream/input-stream";
import { StreamDictionary } from "@dataspecer/core/io/stream/stream-dictionary";
import express from "express";
import { z } from "zod";
import configuration from "../configuration.ts";
import { DefaultArtifactBuilder } from "../generate/default-artifact-builder.ts";
import { ZipStreamDictionary } from "../generate/zip-stream-dictionary.ts";
import { dataSpecificationModel, resourceModel, storeModel } from "../main.ts";
import { LocalStore } from "../models/local-store.ts";
import { LocalStoreDescriptor } from "../models/local-store-descriptor.ts";
import { asyncHandler } from "../utils/async-handler.ts";
import { generateSpecification } from "@dataspecer/specification";
import { BackendModelRepository } from "../utils/model-repository.ts";
import { httpFetch } from "@dataspecer/core/io/fetch/fetch-nodejs";

type FullDataSpecification = DataSpecification & DataSpecificationWithMetadata & DataSpecificationWithStores;

interface DataSpecifications {
  [key: string]: FullDataSpecification;
}

export const generate = asyncHandler(async (request: express.Request, response: express.Response) => {
  const querySchema = z.object({
    iri: z.string().min(1),
  });
  const query = querySchema.parse(request.query);

  const pckg = await resourceModel.getPackage(query.iri);

  if (!pckg) {
    response.status(404).send({ error: "Package does not exist." });
    return;
  }

  const packagesToGenerate = [query.iri];
  const defaultConfiguration = configuration.configuration;
  const dataSpecifications = Object.fromEntries((await dataSpecificationModel.getAllDataSpecifications()).map((s) => [s.iri, s])) as Record<string, FullDataSpecification>;

  const gatheredDataSpecifications: DataSpecifications = {};
  const toProcessDataSpecification = [...packagesToGenerate];

  for (let i = 0; i < toProcessDataSpecification.length; i++) {
    const dataSpecification = dataSpecifications[toProcessDataSpecification[i]];
    gatheredDataSpecifications[dataSpecification.iri as string] = dataSpecification;
    dataSpecification.importsDataSpecifications.forEach((importedDataSpecificationIri) => {
      if (!toProcessDataSpecification.includes(importedDataSpecificationIri)) {
        toProcessDataSpecification.push(importedDataSpecificationIri);
      }
    });
  }

  // Gather all store descriptors

  const storeDescriptors = Object.values(gatheredDataSpecifications).reduce((acc, dataSpecification) => {
    return [...acc, ...dataSpecification.pimStores, ...Object.values(dataSpecification.psmStores).flat(1)];
  }, [] as StoreDescriptor[]);

  // Create stores or use the cache.

  const constructedStores: CoreResourceReader[] = [];

  for (const storeDescriptor of storeDescriptors) {
    const localStoreDescriptor = storeDescriptor as LocalStoreDescriptor;
    const store = new LocalStore(localStoreDescriptor, storeModel);
    await store.loadStore();
    constructedStores.push(store);
  }

  const federatedStore = ReadOnlyFederatedStore.createLazy(constructedStores);

  const generator = new DefaultArtifactBuilder(federatedStore, gatheredDataSpecifications, defaultConfiguration);
  await generator.prepare(Object.keys(gatheredDataSpecifications));
  const data = await generator.build();

  // Send zip file
  response.type("application/zip").send(data);

  return;
});

class SingleFileStreamDictionary implements StreamDictionary {
  requestedFileContents: string | null = null;
  constructor(private requestedFile: string) {}
  readPath(): InputStream {
    throw new Error("Method not implemented.");
  }
  exists(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  list(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  writePath(path: string) {
    return {
      write: async (data: string) => {
        if (path === this.requestedFile) {
          this.requestedFileContents = data;
        }
      },
      close: () => Promise.resolve(),
    };
  }
}

// Debug stream dictionary to see all generated files
class DebugStreamDictionary implements StreamDictionary {
  generatedFiles: string[] = [];
  
  readPath(): InputStream {
    throw new Error("Method not implemented.");
  }
  exists(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  list(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  writePath(path: string) {
    return {
      write: async (data: string) => {
        this.generatedFiles.push(path);
        console.log(`Generated file: ${path} (${data.length} characters)`);
      },
      close: () => Promise.resolve(),
    };
  }
}

async function generateArtifacts(packageIri: string, streamDictionary: StreamDictionary, queryParams: string = "") {
  // Call the main function from @dataspecer/specification
  await generateSpecification(packageIri, {
    modelRepository: new BackendModelRepository(resourceModel),
    output: streamDictionary,
    fetch: httpFetch,
  }, {
    queryParams,
  });
}

export const getZip = asyncHandler(async (request: express.Request, response: express.Response) => {
  const querySchema = z.object({
    iri: z.string().min(1),
  });
  const query = querySchema.parse(request.query);

  const resource = await resourceModel.getPackage(query.iri);

  if (!resource) {
    response.status(404).send({ error: "Package does not exist." });
    return;
  }

  const zip = new ZipStreamDictionary();

  await generateArtifacts(query.iri, zip);

  // Send zip file
  response.type("application/zip").send(await zip.save());
  return;
});

export const getSingleFile = asyncHandler(async (request: express.Request, response: express.Response) => {
  // The path does not start with slash.
  let path = request.params[0];
  if (path === "") {
    path = "index.html";
  }

  const querySchema = z.object({
    iri: z.string().min(1),
    // raw that anything non undefined is true
    raw: z
      .string()
      .optional()
      .transform((value) => value !== undefined)
      .pipe(z.boolean()),
  });
  const query = querySchema.parse(request.query);
  const resource = await resourceModel.getPackage(query.iri);
  if (!resource) {
    response.status(404).send({ error: "Package does not exist." });
    return;
  }

  const streamDictionary = new SingleFileStreamDictionary(path);
  await generateArtifacts(query.iri, streamDictionary, query.raw ? "" : "?iri=" + encodeURIComponent(query.iri));

  if (streamDictionary.requestedFileContents === null) {
    response.status(404).send({ error: "File not found." });
    return;
  } else {
    const type = path.split(".").pop() ?? "";
    switch (type) {
      case "html":
        response.type("text/html");
        break;
      case "ttl":
        response.type("text/turtle");
        break;
      case "svg":
        response.type("image/svg+xml");
        break;
      default:
        response.type("text/plain");
    }
    response.send(streamDictionary.requestedFileContents);
    return;
  }
});

export const getJsonSchema = asyncHandler(async (request: express.Request, response: express.Response) => {
  const querySchema = z.object({
    iri: z.string().min(1),
    psm: z.string().optional(), // Optional PSM IRI to generate schema for specific PSM
  });
  const query = querySchema.parse(request.query);

  const resource = await resourceModel.getPackage(query.iri);
  if (!resource) {
    response.status(404).send({ error: "Package does not exist." });
    return;
  }

  try {
    // Get all data specifications to find PSM schemas
    const dataSpecifications = Object.fromEntries((await dataSpecificationModel.getAllDataSpecifications()).map((s) => [s.iri, s])) as Record<string, FullDataSpecification>;
    
    console.log('Available data specifications:', Object.keys(dataSpecifications));
    console.log('Looking for IRI:', query.iri);
    
    const dataSpec = dataSpecifications[query.iri];
    
    if (!dataSpec) {
      // Try to get the data specification directly by IRI
      console.log('Data specification not found in getAllDataSpecifications, trying direct lookup...');
      
      try {
        // Try using the resource model directly to get package info
        const packageResource = await resourceModel.getPackage(query.iri);
        if (packageResource) {
          console.log('Package found via resourceModel, trying frontend-style JSON schema generation...');
          
          // Try direct JSON schema generation first
          const directSchema = await generateJsonSchemaUsingFrontendLogic(query.iri, query.psm);
          if (directSchema) {
            console.log('Frontend-style JSON schema generation successful');
            response.type("application/json").send(directSchema);
            return;
          }
          
          console.log('Frontend-style generation returned null, trying original artifact system...');
          
          // First, let's see what files are actually generated
          const debugStreamDict = new DebugStreamDictionary();
          await generateArtifacts(query.iri, debugStreamDict, "?iri=" + encodeURIComponent(query.iri));
          
          console.log('All generated files:', debugStreamDict.generatedFiles);
          
          // Now look for JSON schema files in the actual generated files
          const jsonSchemaFiles = debugStreamDict.generatedFiles.filter(path => 
            path.toLowerCase().includes('schema') && 
            (path.endsWith('.json') || path.includes('json'))
          );
          
          console.log('JSON schema candidates:', jsonSchemaFiles);
          
          // Try to get the first JSON schema file we find
          if (jsonSchemaFiles.length > 0) {
            for (const schemaFile of jsonSchemaFiles) {
              const streamDict = new SingleFileStreamDictionary(schemaFile);
              await generateArtifacts(query.iri, streamDict, "?iri=" + encodeURIComponent(query.iri));
              if (streamDict.requestedFileContents) {
                console.log(`Found JSON schema at: ${schemaFile}`);
                response.type("application/json").send(streamDict.requestedFileContents);
                return;
              }
            }
          }
          
          // If no schema files found, try the standard paths
          const possiblePaths = [
            "schema.json",
            "cs/schema.json", 
            "en/schema.json",
            "artifacts/schema.json",
            "json-schema/schema.json"
          ];
          
          for (const path of possiblePaths) {
            const streamDict = new SingleFileStreamDictionary(path);
            await generateArtifacts(query.iri, streamDict, "?iri=" + encodeURIComponent(query.iri));
            if (streamDict.requestedFileContents) {
              console.log(`Found schema at path: ${path}`);
              response.type("application/json").send(streamDict.requestedFileContents);
              return;
            }
          }
          
          console.log('No JSON schema found in any expected paths, falling back to basic schema');
          
          // Last resort - return the basic schema we had before that was working
          const basicJsonSchema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object", 
            "title": `Schema for package ${query.iri}`,
            "description": `Generated basic schema for package ${query.iri}`,
            "properties": {
              "@context": {
                "type": "string",
                "description": "JSON-LD context"
              },
              "@type": {
                "type": "string", 
                "description": "RDF type"
              }
            },
            "additionalProperties": true
          };

          response.type("application/json").send(JSON.stringify(basicJsonSchema, null, 2));
          return;
        }
      } catch (artifactError) {
        console.log('Artifact generation failed:', artifactError);
      }
      
      response.status(404).send({ error: "Data specification not found." });
      return;
    }

    console.log('Data specification found:', dataSpec.iri);
    console.log('PSM stores available:', Object.keys(dataSpec.psmStores || {}));

    // Find PSM schemas in this data specification
    const psmSchemas = Object.keys(dataSpec.psmStores || {});
    
    if (psmSchemas.length === 0) {
      console.log('No PSM schemas found, falling back to artifact generation...');
      
      // Try artifact generation as fallback
      const streamDictionary = new SingleFileStreamDictionary("schema.json");
      await generateArtifacts(query.iri, streamDictionary);

      if (streamDictionary.requestedFileContents) {
        response.type("application/json").send(streamDictionary.requestedFileContents);
        return;
      }

      // Final fallback - basic schema
      const basicJsonSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object", 
        "title": `Schema for ${query.iri}`,
        "description": `No PSM schemas found for package ${query.iri}`,
        "properties": {
          "@context": {
            "type": "string",
            "description": "JSON-LD context"
          },
          "@type": {
            "type": "string", 
            "description": "RDF type"
          }
        },
        "additionalProperties": true
      };

      response.type("application/json").send(JSON.stringify(basicJsonSchema, null, 2));
      return;
    }

    // Use specific PSM if provided, otherwise use the first one
    const targetPsmIri = query.psm || psmSchemas[0];
    const targetPsm = psmSchemas.find((psm: string) => psm === targetPsmIri);
    
    console.log('Target PSM IRI:', targetPsmIri);
    console.log('PSM found:', !!targetPsm);
    
    if (!targetPsm) {
      response.status(404).send({ error: `PSM schema ${targetPsmIri} not found in package.` });
      return;
    }

    // Try to generate using the artifact generation system targeting the specific PSM
    const streamDictionary = new SingleFileStreamDictionary("schema.json");
    
    // Create a minimal context that focuses on this PSM schema
    const artifactContext = {
      modelRepository: new BackendModelRepository(resourceModel),
      output: streamDictionary,
      fetch: httpFetch,
    };

    // Try to generate using the PSM schema directly
    await generateSpecification(targetPsmIri, artifactContext);

    if (streamDictionary.requestedFileContents) {
      response.type("application/json").send(streamDictionary.requestedFileContents);
      return;
    }

    // If that doesn't work, try generating from the package and look for artifacts
    await generateArtifacts(query.iri, streamDictionary);

    if (streamDictionary.requestedFileContents) {
      response.type("application/json").send(streamDictionary.requestedFileContents);
      return;
    }

    // Final fallback - basic schema
    const basicJsonSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object", 
      "title": `Schema for PSM ${targetPsmIri}`,
      "description": `Generated basic schema for PSM ${targetPsmIri}`,
      "properties": {
        "@context": {
          "type": "string",
          "description": "JSON-LD context"
        },
        "@type": {
          "type": "string", 
          "description": "RDF type"
        }
      },
      "additionalProperties": true
    };

    response.type("application/json").send(JSON.stringify(basicJsonSchema, null, 2));
    return;

  } catch (error) {
    console.error("Error generating JSON schema:", error);
    response.status(500).send({ error: "Failed to generate JSON schema" });
    return;
  }
});

async function generateJsonSchemaUsingFrontendLogic(packageIri: string, psmIri?: string): Promise<string | null> {
  try {
    console.log('Attempting frontend-style JSON schema generation for package:', packageIri, 'PSM:', psmIri);
    
    // Get the package resource
    const packageResource = await resourceModel.getPackage(packageIri);
    if (!packageResource) {
      console.log('Package not found');
      return null;
    }

    // Find PSM schemas in the package if no specific PSM provided
    if (!psmIri && packageResource.subResources) {
      const psmResources = packageResource.subResources.filter((r: any) => 
        r.types?.includes('https://schemas.dataspecer.com/core/data-psm/schema')
      );
      if (psmResources.length > 0) {
        psmIri = psmResources[0].iri;
        console.log('Found PSM schemas in package:', psmResources.map((r: any) => r.iri));
      }
    }

    if (!psmIri) {
      console.log('No PSM schema found for generation');
      return null;
    }

    // Try to use the existing artifact generation with explicit JSON schema path
    // Check if schema.json exists in the generated files
    const possibleJsonSchemaPaths = [
      `${psmIri}/schema.json`,
      `schema.json`, 
      `en/schema.json`,
      `cs/schema.json`,
      `json/schema.json`
    ];

    for (const path of possibleJsonSchemaPaths) {
      const streamDict = new SingleFileStreamDictionary(path);
      await generateArtifacts(packageIri, streamDict, "?iri=" + encodeURIComponent(packageIri));
      
      if (streamDict.requestedFileContents) {
        console.log(`Frontend-style JSON schema found at path: ${path}`);
        return streamDict.requestedFileContents;
      }
    }

    // If specific paths don't work, try using the debug approach to find all files
    const debugStreamDict = new DebugStreamDictionary();
    await generateArtifacts(packageIri, debugStreamDict, "?iri=" + encodeURIComponent(packageIri));
    
    console.log('All generated files for JSON schema search:', debugStreamDict.generatedFiles);
    
    // Look for any JSON files that might be schemas
    const jsonFiles = debugStreamDict.generatedFiles.filter(path => 
      path.toLowerCase().includes('json') || path.toLowerCase().includes('schema')
    );
    
    console.log('Potential JSON schema files:', jsonFiles);

    // Try each JSON file
    for (const jsonFile of jsonFiles) {
      const streamDict = new SingleFileStreamDictionary(jsonFile);
      await generateArtifacts(packageIri, streamDict, "?iri=" + encodeURIComponent(packageIri));
      
      if (streamDict.requestedFileContents) {
        console.log(`Found JSON content at: ${jsonFile}`);
        // Check if it looks like a JSON schema
        try {
          const parsed = JSON.parse(streamDict.requestedFileContents);
          if (parsed.$schema || parsed.type || parsed.properties) {
            console.log('Content appears to be a JSON schema');
            return streamDict.requestedFileContents;
          }
        } catch (e) {
          // Not valid JSON
        }
      }
    }

    console.log('Frontend-style generation failed to find JSON schema');
    return null;
  } catch (error) {
    console.log('Frontend-style JSON schema generation failed:', error);
    return null;
  }
}
