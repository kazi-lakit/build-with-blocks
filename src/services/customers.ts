const GATEWAY_URL =
  import.meta.env.VITE_DATA_GATEWAY_URL || 'https://api.seliseblocks.com/data/v4/gateway';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || '';

export interface CustomerItem {
  ItemId: string;
  CreatedDate?: string;
  Name: string;
  Type: string;
  ImageId?: string;
  Status: string;
  Email: string;
  PhoneNumber?: string;
}

export interface GetCustomersResult {
  items: CustomerItem[];
  totalCount: number;
  pageNo: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GetCustomersError {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GetCustomersError[];
}

const GET_CUSTOMERS_QUERY = (pageNo: number, pageSize: number) => `
  query {
    getCustomers(
      where: {}
      order: []
      paging: { pageNo: ${pageNo}, pageSize: ${pageSize} }
    ) {
      items {
        ItemId
        CreatedDate
        Name
        Type
        ImageId
        Status
        Email
        PhoneNumber
      }
      totalCount
      pageNo
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

export async function getCustomers(
  pageNo = 1,
  pageSize = 10,
): Promise<GetCustomersResult> {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify({
      query: GET_CUSTOMERS_QUERY(pageNo, pageSize),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to load customers (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<{
    getCustomers: GetCustomersResult;
  }>;

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data?.getCustomers) {
    throw new Error('Unexpected response from data gateway');
  }

  return json.data.getCustomers;
}

export interface InsertCustomerInput {
  Name: string;
  Type: string;
  ImageId?: string;
  Status: string;
  Email: string;
  PhoneNumber?: string;
}

export interface InsertCustomerResult {
  acknowledged: boolean;
  itemId: string;
  totalImpactedData: number;
  message?: string;
}

const INSERT_CUSTOMER_MUTATION = (input: InsertCustomerInput) => `
  mutation {
    insertCustomer(input: {
      Name: ${JSON.stringify(input.Name)}
      Type: ${JSON.stringify(input.Type)}
      ImageId: ${JSON.stringify(input.ImageId ?? '')}
      Status: ${JSON.stringify(input.Status)}
      Email: ${JSON.stringify(input.Email)}
      PhoneNumber: ${JSON.stringify(input.PhoneNumber ?? '')}
    }) {
      acknowledged
      itemId
      totalImpactedData
      message
    }
  }
`;

export async function insertCustomer(
  input: InsertCustomerInput,
): Promise<InsertCustomerResult> {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify({
      query: INSERT_CUSTOMER_MUTATION(input),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to create customer (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<{
    insertCustomer: InsertCustomerResult;
  }>;

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data?.insertCustomer) {
    throw new Error('Unexpected response from data gateway');
  }

  return json.data.insertCustomer;
}

const UPDATE_CUSTOMER_MUTATION = (itemId: string, status: string) => `
  mutation {
    updateCustomer(
      where: { ItemId: { eq: ${JSON.stringify(itemId)} } }
      input: { Status: ${JSON.stringify(status)} }
    ) {
      acknowledged
      itemId
      totalImpactedData
      message
    }
  }
`;

export async function updateCustomerStatus(
  itemId: string,
  status: string,
): Promise<InsertCustomerResult> {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify({
      query: UPDATE_CUSTOMER_MUTATION(itemId, status),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to update customer (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<{
    updateCustomer: InsertCustomerResult;
  }>;

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data?.updateCustomer) {
    throw new Error('Unexpected response from data gateway');
  }

  return json.data.updateCustomer;
}

const DELETE_CUSTOMER_MUTATION = (itemId: string, isHardDelete: boolean) => `
  mutation {
    deleteCustomer(
      where: { ItemId: { eq: ${JSON.stringify(itemId)} } }
      input: { isHardDelete: ${isHardDelete ? 'true' : 'false'} }
    ) {
      acknowledged
      itemId
      totalImpactedData
      message
    }
  }
`;

export async function deleteCustomer(
  itemId: string,
  isHardDelete = false,
): Promise<InsertCustomerResult> {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify({
      query: DELETE_CUSTOMER_MUTATION(itemId, isHardDelete),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to delete customer (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<{
    deleteCustomer: InsertCustomerResult;
  }>;

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data?.deleteCustomer) {
    throw new Error('Unexpected response from data gateway');
  }

  return json.data.deleteCustomer;
}