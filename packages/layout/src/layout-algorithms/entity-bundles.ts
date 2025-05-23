import {
    SemanticModelEntity,
    isSemanticModelClass,
    isSemanticModelRelationship,
    isSemanticModelGeneralization,
    SemanticModelClass,
    SemanticModelGeneralization,
    SemanticModelRelationship,
    isSemanticModelAttribute
 } from "@dataspecer/core-v2/semantic-model/concepts";

import { Entity, EntityModel } from "@dataspecer/core-v2";
import {
    isSemanticModelClassProfile,
    isSemanticModelRelationshipProfile,
    SemanticModelClassProfile,
    SemanticModelRelationshipProfile
} from "@dataspecer/core-v2/semantic-model/profile/concepts";


export type EntityBundle = {
    sourceModelIdentifier: string,
    semanticEntity: SemanticModelEntity,
};

type ClassBundle = {
    sourceModelIdentifier: string,
    semanticClass: SemanticModelClass,
};

type ClassProfileBundle = {
    sourceModelIdentifier: string,
    semanticClassProfile: SemanticModelClassProfile
};

export type RelationshipBundle = {
    sourceModelIdentifier: string,
    semanticRelationship: SemanticModelRelationship,
};

export type RelationshipProfileBundle = {
    sourceModelIdentifier: string,
    semanticRelationshipProfile: SemanticModelRelationshipProfile,
};

export type GeneralizationBundle = {
    sourceModelIdentifier: string,
    semanticGeneralization: SemanticModelGeneralization,
};

type AttributeBundle = {
    sourceModelIdentifier: string,
    semanticRelationship: SemanticModelRelationship,
};


export interface ExtractedModels {
    entities: EntityBundle[],
    classes: ClassBundle[],
    classesProfiles: ClassProfileBundle[],
    relationships: RelationshipBundle[],
    relationshipsProfiles: RelationshipProfileBundle[],
    generalizations: GeneralizationBundle[],
    attributes: AttributeBundle[],
}

export type AllowedEdgeBundleTypes = RelationshipBundle | RelationshipProfileBundle | GeneralizationBundle | ClassProfileBundle;


function filterForExtraction(entities: EntityBundle[], predicate: (resource: Entity | null) => boolean) {
    const values = entities.filter(({semanticEntity: semanticModelEntity}) => {
        return predicate(semanticModelEntity);
    });

    return values;
}

/**
 * Converts entities from given semantic model into concrete data types. Returns them in object of type {@link ExtractedModels}
 */
export function extractModelObjects(inputSemanticModels: Map<string, EntityModel>): ExtractedModels {
    const entitiesInModels: EntityBundle[][] = [...inputSemanticModels.entries()].map(([modelIdentifier, model]) => {
        return Object.entries(model.getEntities() as Record<string, SemanticModelEntity>).map(([key, value]) => ({
            sourceModelIdentifier: modelIdentifier,
            semanticEntity: value,
        }));
    });

    const entities: EntityBundle[] = [];
    entitiesInModels.forEach(model => {
        entities.push(...model);
    });

    const classes = filterForExtraction(entities, isSemanticModelClass).map((o) => {
        return {
            sourceModelIdentifier: o.sourceModelIdentifier,
            semanticClass: o.semanticEntity as SemanticModelClass,
        }
    });
    const classesProfiles = filterForExtraction(entities, isSemanticModelClassProfile).map((o) => {
        return {
            sourceModelIdentifier: o.sourceModelIdentifier,
            semanticClassProfile: o.semanticEntity as SemanticModelClassProfile,
        }
    });


    // TODO Hard to solve by myself - Radstr: Profiles - the isSemanticModelAttributeProfile is internal function
    //   of the CME, since it is probably kind of hack, so we can not check it here
    //   So now this contains both relationship profiles and attribute profiles
    //   which matters only if we are using the reactflow dimension estimator.
    //   Currently only the semantic attributes are estimated, the semantic profile attributes not.
    // ... So final remarks idelly we would have relationshipProfiles and attributeProfiles
    const relationshipsProfiles = filterForExtraction(entities, isSemanticModelRelationshipProfile).map((o) => {
        return {
            sourceModelIdentifier: o.sourceModelIdentifier,
            semanticRelationshipProfile: o.semanticEntity as unknown as SemanticModelRelationshipProfile,
        }
    });
    const generalizations = filterForExtraction(entities, isSemanticModelGeneralization).map((o) => {
        return {
            sourceModelIdentifier: o.sourceModelIdentifier,
            semanticGeneralization: o.semanticEntity as SemanticModelGeneralization,
        }
    });
    const attributes = filterForExtraction(entities, isSemanticModelAttribute).map((o) => {
        return {
            sourceModelIdentifier: o.sourceModelIdentifier,
            semanticRelationship: o.semanticEntity as SemanticModelRelationship,
        }
    });

    const relationships = entities
        .filter((o) => (isSemanticModelRelationship(o.semanticEntity) &&
                        !isSemanticModelAttribute(o.semanticEntity)))
            .map((o) => {
                return {
                    sourceModelIdentifier: o.sourceModelIdentifier,
                    semanticRelationship: o.semanticEntity as SemanticModelRelationship,
                }
            });


    return {
        entities,
        classes,
        classesProfiles,
        relationships,
        relationshipsProfiles,
        generalizations,
        attributes,
    };
}



type RelationshipSourceTarget = {
    source: string,
    target: string,
    sourceIndex: 0 | 1,
    targetIndex: 0 | 1,
}

/**
 * @returns Returns the identifiers of source and target for {@link relationship} and the index where each end lies.
 */
export function getEdgeSourceAndTargetRelationship(
    relationship: SemanticModelRelationship | SemanticModelRelationshipProfile
): RelationshipSourceTarget {
    let source, target: string;
    let sourceIndex, targetIndex: 0 | 1;
    if(relationship.ends[0].iri == null) {
        sourceIndex = 0;
        targetIndex = 1;
    }
    else {
        sourceIndex = 1;
        targetIndex = 0;
    }

    source = relationship.ends[sourceIndex].concept;
    target = relationship.ends[targetIndex].concept;

    return {source, target, sourceIndex, targetIndex};
}


export function getEdgeSourceAndTargetGeneralization(relationship: SemanticModelGeneralization): {source: string, target: string} {
    return {source: relationship.child, target: relationship.parent};
}
