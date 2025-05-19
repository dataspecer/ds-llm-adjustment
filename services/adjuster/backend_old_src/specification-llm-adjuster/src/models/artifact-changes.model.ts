
    export interface ArtifactChanges {
        addedProperties: AddedProperty[];
        removedProperties: RemovedProperty[];
        changedProperties: ChangedProperty[];
        addedClasses: AddedClass[];
        addedConnections: AddedConnection[];
        removedConnections: RemovedConnection[];
        removedClasses: RemovedClass[];
    }

    export interface Change {
        changeId: number;
        alternativeChangeId: number[];
        relatedChangeId: number[];
    }

    export interface AddedProperty extends Change {
        changeId: number;
        propertyName: string;
        className: string;
        dataType: string;
        vocabulary: string;
    }

    export interface RemovedProperty extends Change {
        propertyName: string;
        className: string;
    }

    export interface ChangedProperty extends Change {
        oldpropertyName: string;
        newPropertyName: string;
        oldDataType: string;
        newDataType: string;
    }

    export interface AddedClass extends Change {
        className: string;
        vocabulary: string;
    }

    export interface ChangedClass extends Change {
        oldClassName: string;
        newClassName: string;
    }

    export interface AddedConnection extends Change {
        source: string;
        target: string;
        connectionType: string;
    }

    export interface RemovedConnection extends Change {
        source: string;
        target: string;
        connectionType: string;
    }

    export interface RemovedClass extends Change {
        id: string;
    }